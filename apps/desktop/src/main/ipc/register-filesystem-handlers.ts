import { fsContracts, registerContractHandler } from "@pi-desktop/contracts";
import { PathGuardError, resolveInsideRoot } from "../fs/path-guards";

/**
 * Maximum size, in bytes, of a single read or write operation. Reads above
 * this size return `truncated: true` so the renderer can offer the user a
 * streaming viewer. Writes above this size are rejected at the contract schema.
 */
const MAX_READ_BYTES = 1 * 1024 * 1024; // 1 MB
/** Number of leading bytes scanned for NULs to detect binary files. */
const BINARY_SNIFF_BYTES = 8192;

const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
]);

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".xml",
  ".sql",
  ".env",
  ".gitignore",
  ".dockerignore",
  ".editorconfig",
  ".conf",
  ".config",
  ".cfg",
  ".ini",
  ".log",
  ".csv",
  ".tsv",
]);

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

interface RegisterFilesystemHandlersDependencies {
  handle: (
    channel: string,
    listener: (event?: unknown, payload?: unknown) => unknown,
  ) => void;
  getWorkspaceRootPath(): string | null;
}

function isVisibleFilesystemEntry(entry: {
  isDirectory(): boolean;
  isFile(): boolean;
}): boolean {
  return entry.isDirectory() || entry.isFile();
}

function requireRoots(getWorkspaceRootPath: () => string | null): string[] {
  const root = getWorkspaceRootPath();
  if (!root) {
    throw new PathGuardError({
      code: "path/no-root-configured",
      message: "workspace root is not configured",
    });
  }
  return [root];
}

export function registerFilesystemHandlers({
  handle,
  getWorkspaceRootPath,
}: RegisterFilesystemHandlersDependencies): void {
  registerContractHandler({
    handle,
    contract: fsContracts.readDirectory,
    handler: async ({ path: dirPath }) => {
      try {
        const roots = requireRoots(getWorkspaceRootPath);
        const canonicalTarget = resolveInsideRoot(roots, dirPath);

        const pathModule = await import("node:path");
        const fsModule = await import("node:fs");
        const entries = fsModule.readdirSync(canonicalTarget, {
          withFileTypes: true,
        });
        const result = entries
          .filter(
            (entry) =>
              !entry.name.startsWith(".") && isVisibleFilesystemEntry(entry),
          )
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map((entry) => ({
            name: entry.name,
            path: pathModule.join(canonicalTarget, entry.name),
            type: entry.isDirectory()
              ? ("directory" as const)
              : ("file" as const),
            extension: entry.isFile() ? entry.name.split(".").pop() : undefined,
          }));
        return { path: dirPath, entries: result };
      } catch (error) {
        if (error instanceof PathGuardError) {
          return {
            success: false as const,
            error: error.message,
            code: error.code,
          };
        }
        throw error;
      }
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.readFile,
    handler: async ({ path: filePath }) => {
      const roots = requireRoots(getWorkspaceRootPath);
      const authorizedPath = resolveInsideRoot(roots, filePath);

      const { readFileSync, statSync } = await import("node:fs");
      const { extname } = await import("node:path");

      const ext = extname(authorizedPath).toLowerCase();
      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isText = TEXT_EXTENSIONS.has(ext) || (!ext && !isImage);

      if (isImage) {
        const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";
        const stats = statSync(authorizedPath);
        if (stats.size > MAX_READ_BYTES) {
          return {
            path: filePath,
            content: "",
            type: "image" as const,
            mimeType,
            size: stats.size,
            truncated: true,
          };
        }
        const buffer = readFileSync(authorizedPath);
        return {
          path: filePath,
          content: `data:${mimeType};base64,${buffer.toString("base64")}`,
          type: "image" as const,
          mimeType,
          size: stats.size,
        };
      }

      if (!isText) {
        return { path: filePath, content: "", type: "unsupported" as const };
      }

      const stats = statSync(authorizedPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a regular file: ${filePath}`);
      }

      if (stats.size > MAX_READ_BYTES) {
        return {
          path: filePath,
          content: "",
          type: "text" as const,
          encoding: "utf-8",
          truncated: true,
          size: stats.size,
        };
      }

      const buffer = readFileSync(authorizedPath);
      const sniffLength = Math.min(buffer.length, BINARY_SNIFF_BYTES);
      for (let index = 0; index < sniffLength; index += 1) {
        if (buffer[index] === 0) {
          return {
            path: filePath,
            content: "",
            type: "binary" as const,
            size: stats.size,
          };
        }
      }

      return {
        path: filePath,
        content: buffer.toString("utf-8"),
        type: "text" as const,
        encoding: "utf-8",
        size: stats.size,
      };
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.writeFile,
    handler: async ({ path: filePath, content }) => {
      const roots = requireRoots(getWorkspaceRootPath);
      const authorizedPath = resolveInsideRoot(roots, filePath, {
        allowCreate: true,
      });

      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(authorizedPath), { recursive: true });
      await writeFile(authorizedPath, content, "utf-8");
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.deleteFile,
    handler: async ({ path: filePath }) => {
      const roots = requireRoots(getWorkspaceRootPath);
      const authorizedPath = resolveInsideRoot(roots, filePath);

      const { rm } = await import("node:fs/promises");
      await rm(authorizedPath, { recursive: true, force: true });
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.renameFile,
    handler: async ({ oldPath, newPath }) => {
      const roots = requireRoots(getWorkspaceRootPath);
      const resolvedOldPath = resolveInsideRoot(roots, oldPath);
      const resolvedNewPath = resolveInsideRoot(roots, newPath, {
        allowCreate: true,
      });

      const { rename } = await import("node:fs/promises");
      await rename(resolvedOldPath, resolvedNewPath);
    },
  });

  registerContractHandler({
    handle,
    contract: fsContracts.moveFile,
    handler: async ({ sourcePath, destinationPath }) => {
      const roots = requireRoots(getWorkspaceRootPath);
      const resolvedSource = resolveInsideRoot(roots, sourcePath);
      const resolvedDest = resolveInsideRoot(roots, destinationPath, {
        allowCreate: true,
      });

      const { mkdir, rename } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(resolvedDest), { recursive: true });
      await rename(resolvedSource, resolvedDest);
    },
  });
}
