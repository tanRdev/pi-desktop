import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  SearchMatch,
  SearchRequest,
  SearchResponse,
} from "@pidesk/shared";

const DEFAULT_TIMEOUT_MS = 10_000;

function globToRegExp(pattern: string): RegExp {
  // escape regex meta
  const esc = pattern.replace(/[.+^${}()|\\]/g, "\\$&");
  // convert /**/ and * -> regex
  const withGlob = esc
    .replace(/\\\\\*\\\\\*/g, "__DOUBLE_STAR__") // protect already-escaped
    .replace(/\\\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");

  return new RegExp(`^(?:${withGlob})$`);
}

function matchesAnyPattern(relativePath: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => {
    try {
      const re = globToRegExp(p);
      return re.test(relativePath);
    } catch {
      // fallback to simple substring match
      return relativePath.includes(p);
    }
  });
}

function toSearchMatch(
  rootPath: string,
  filePath: string,
  score = 0,
): SearchMatch {
  const full = path.resolve(rootPath, filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath).replace(/^\./, "") || undefined;
  let type: "file" | "directory" = "file";
  try {
    const st = fs.statSync(full);
    type = st.isDirectory() ? "directory" : "file";
  } catch {
    // keep as file when stat fails
  }

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
    let results: SearchMatch[] = [];

    try {
      results = await this.runFffSearch(request);
    } catch (_err) {
      // Use fallback; keep error logging minimal in main process
      results = await this.fallbackSearch(request);
    }

    const max = request.maxResults ?? results.length;
    const sliced = results.slice(0, max);

    return {
      query: request.query,
      results: sliced,
      total: results.length,
      duration: Date.now() - start,
    };
  }

  private runFffSearch(request: SearchRequest): Promise<SearchMatch[]> {
    return new Promise((resolve, reject) => {
      const args = ["find", "--json", request.query];
      const proc = spawn("fff", args, { cwd: request.rootPath });

      let stdout = "";
      let stderr = "";
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            proc.kill();
          } catch {
            // ignore
          }
          reject(new Error("fff: timeout"));
        }
      }, this.timeoutMs);

      proc.stdout?.on("data", (chunk) => (stdout += String(chunk)));
      proc.stderr?.on("data", (chunk) => (stderr += String(chunk)));

      proc.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        finished = true;
        // fff not installed or spawn failed
        if (err.code === "ENOENT") {
          reject(new Error("fff: not found"));
        } else {
          reject(err);
        }
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (finished) return;
        finished = true;

        if (code !== 0) {
          return reject(
            new Error(`fff exited with code ${code}: ${stderr.trim()}`),
          );
        }

        try {
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

          // apply include/exclude patterns if any
          const filtered = mapped.filter((m) => {
            const relPath = path
              .relative(request.rootPath, m.path)
              .replace(/\\\\/g, "/");
            if (!matchesAnyPattern(relPath, request.includePatterns))
              return false;
            if (request.excludePatterns && request.excludePatterns.length > 0) {
              if (
                !matchesAnyPattern(
                  relPath,
                  request.excludePatterns.map((p) =>
                    p.startsWith("!") ? p.slice(1) : p,
                  ),
                )
              ) {
                // If exclude patterns provided, and none match, keep; if any match, remove
              }
            }
            // exclude check using any match
            if (
              request.excludePatterns?.some((p) =>
                globToRegExp(p).test(relPath),
              )
            ) {
              return false;
            }
            return true;
          });

          resolve(filtered);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
    });
  }

  private async fallbackSearch(request: SearchRequest): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];
    const root = path.resolve(request.rootPath);
    const max = request.maxResults ?? Infinity;

    async function walker(dir: string) {
      if (results.length >= max) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
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

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (isRecord(parsed) && Array.isArray(parsed.results))
      return parsed.results;
  } catch {
    // try NDJSON (newline-delimited JSON) below
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const out: unknown[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // ignore unparsable lines
    }
  }
  return out;
}
