import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  SearchMatch,
  SearchRequest,
  SearchResponse,
} from "@pi-desktop/shared";
import { Duration, Effect } from "effect";

const DEFAULT_TIMEOUT_MS = 10_000;

function globToRegExp(pattern: string): RegExp {
  const esc = pattern.replace(/[.+^${}()|\\]/g, "\\$&");
  const withGlob = esc
    .replace(/\\\\\*\\\\\*/g, "__DOUBLE_STAR__")
    .replace(/\\\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");

  return new RegExp(`^(?:${withGlob})$`);
}

function matchesAnyPattern(relativePath: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => globToRegExp(pattern).test(relativePath));
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toSearchMatch(
  rootPath: string,
  filePath: string,
  score = 0,
): SearchMatch {
  const full = path.resolve(rootPath, filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath).replace(/^\./, "") || undefined;
  const stat = fs.statSync(full, { throwIfNoEntry: false });
  const type = stat?.isDirectory() ? "directory" : "file";

  return {
    path: full,
    name,
    score,
    type,
    extension: ext,
    highlights: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getItemPath(item: unknown): string | null {
  if (!isRecord(item)) {
    return null;
  }
  const value = item.path ?? item.file ?? item.name;
  return typeof value === "string" ? value : null;
}

function getItemScore(item: unknown): number {
  if (!isRecord(item)) {
    return 0;
  }
  return typeof item.score === "number" ? item.score : 0;
}

function getItemHighlights(
  item: unknown,
): Array<{ start: number; end: number }> {
  if (!isRecord(item) || !Array.isArray(item.highlights)) {
    return [];
  }

  return item.highlights.flatMap((highlight) => {
    if (!isRecord(highlight)) {
      return [];
    }
    const start = highlight.start;
    const end = highlight.end;
    if (typeof start !== "number" || typeof end !== "number") {
      return [];
    }
    return [{ start, end }];
  });
}

export class WorkspaceSearchService {
  constructor(private timeoutMs = DEFAULT_TIMEOUT_MS) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const start = Date.now();

    const program = this.runFffSearch(request).pipe(
      Effect.timeout(Duration.millis(this.timeoutMs)),
      Effect.catchAll(() => this.fallbackSearchEffect(request)),
    );

    const results = await Effect.runPromise(program);

    const max = request.maxResults ?? results.length;
    const sliced = results.slice(0, max);

    return {
      query: request.query,
      results: sliced,
      total: results.length,
      duration: Date.now() - start,
    };
  }

  private runFffSearch(
    request: SearchRequest,
  ): Effect.Effect<SearchMatch[], Error> {
    return Effect.async<SearchMatch[], Error>((resume) => {
      const args = ["find", "--json", request.query];
      const proc = spawn("fff", args, { cwd: request.rootPath });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk) => (stdout += String(chunk)));
      proc.stderr?.on("data", (chunk) => (stderr += String(chunk)));

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          resume(Effect.fail(new Error("fff: not found")));
        } else {
          resume(Effect.fail(err));
        }
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          return resume(
            Effect.fail(
              new Error(`fff exited with code ${code}: ${stderr.trim()}`),
            ),
          );
        }

        const parsed = parseFffJson(stdout);
        const mapped = parsed
          .map((item) => {
            const itemPath = getItemPath(item);
            if (!itemPath) return null;
            const rel = path.isAbsolute(itemPath)
              ? path.relative(request.rootPath, itemPath)
              : itemPath;
            const match = toSearchMatch(
              request.rootPath,
              rel,
              getItemScore(item),
            );
            match.highlights = getItemHighlights(item);
            return match;
          })
          .filter((match): match is SearchMatch => match !== null);

        const filtered = mapped.filter((match) => {
          const relPath = path
            .relative(request.rootPath, match.path)
            .replace(/\\\\/g, "/");
          if (!matchesAnyPattern(relPath, request.includePatterns)) {
            return false;
          }
          if (
            request.excludePatterns?.some((pattern) =>
              globToRegExp(pattern).test(relPath),
            )
          ) {
            return false;
          }
          return true;
        });

        resume(Effect.succeed(filtered));
      });

      return Effect.sync(() => {
        if (!proc.killed) {
          proc.kill();
        }
      });
    });
  }

  private fallbackSearchEffect(
    request: SearchRequest,
  ): Effect.Effect<SearchMatch[], Error> {
    return Effect.tryPromise({
      try: () => this.fallbackSearch(request),
      catch: (e) => new Error(`fallback search failed: ${e}`),
    });
  }

  private async fallbackSearch(request: SearchRequest): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];
    const root = path.resolve(request.rootPath);
    const max = request.maxResults ?? Infinity;

    async function walker(dir: string) {
      if (results.length >= max) return;
      const entries = await fs.promises
        .readdir(dir, { withFileTypes: true })
        .then(
          (value) => value,
          () => null,
        );
      if (!entries) {
        return;
      }

      for (const ent of entries) {
        if (results.length >= max) break;
        const full = path.join(dir, ent.name);
        const rel = path.relative(root, full).replace(/\\\\/g, "/");

        // simple dotfile/node_modules ignore
        if (rel.split("/").includes("node_modules")) continue;

        if (ent.isDirectory()) {
          // check include/exclude before descending
          if (
            matchesAnyPattern(`${rel}/`, request.includePatterns) &&
            !request.excludePatterns?.some((p) =>
              globToRegExp(p).test(`${rel}/`),
            )
          ) {
            // include directory as match
            results.push(toSearchMatch(root, rel, 0));
          }
          await walker(full);
        } else if (ent.isFile()) {
          if (!matchesAnyPattern(rel, request.includePatterns)) continue;
          if (request.excludePatterns?.some((p) => globToRegExp(p).test(rel)))
            continue;
          results.push(toSearchMatch(root, rel, 0));
        }
      }
    }

    await walker(root);
    return results;
  }
}

function parseFffJson(stdout: string): unknown[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  const parsed = safeJsonParse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (isRecord(parsed) && Array.isArray(parsed.results)) {
    return parsed.results;
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const out: unknown[] = [];
  for (const line of lines) {
    const item = safeJsonParse(line);
    if (item !== null) {
      out.push(item);
    }
  }
  return out;
}
