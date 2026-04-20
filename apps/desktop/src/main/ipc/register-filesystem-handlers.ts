import { IPC_CHANNELS } from "@pi-desktop/shared";
import { PathGuardError, resolveInsideRoot } from "../fs/path-guards";
import {
  getStringField,
  PayloadValidationError,
  requireStringField,
} from "./payload-parsers";

/**
 * Maximum size, in bytes, of a single read or write operation. Reads above
 * this size return `truncated: true` so the renderer can offer the user a
 * streaming viewer. Writes above this size are rejected outright.
 */
const MAX_READ_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_WRITE_BYTES = 10 * 1024 * 1024; // 10 MB
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
  handle(IPC_CHANNELS.fs.readDirectory, async (_event, payload) => {
    try {
      const dirPath = requireStringField(payload, "path");
      const roots = requireRoots(getWorkspaceRootPath);
      const canonicalTarget = resolveInsideRoot(roots, dirPath);

      const pathModule = await import("node:path");
      const fsModule = await import("node:fs");
      const entries = fsModule.readdirSync(canonicalTarget, {
        withFileTypes: true,
      });
      const result = entries
        .filter((entry) => !entry.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((entry) => ({
          name: entry.name,
          path: pathModule.join(canonicalTarget, entry.name),
          type: entry.isDirectory() ? "directory" : "file",
          extension: entry.isFile() ? entry.name.split(".").pop() : undefined,
        }));
      return { path: dirPath, entries: result };
    } catch (error) {
      // Mirror the pre-existing contract for this channel: return `{success:
      // false, error}` instead of rejecting. Sanitize the error message.
      if (
        error instanceof PathGuardError ||
        error instanceof PayloadValidationError
      ) {
        return { success: false, error: error.message, code: error.code };
      }
      throw error;
    }
  });

  handle(IPC_CHANNELS.fs.readFile, async (_event, payload) => {
    const filePath = requireStringField(payload, "path");
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
        // Binary file: reject text read instead of returning mojibake.
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
  });

  handle(IPC_CHANNELS.fs.writeFile, async (_event, payload) => {
    const filePath = requireStringField(payload, "path");
    let content: string | undefined;
    try {
      content = getStringField(payload, "content", {
        maxBytes: MAX_WRITE_BYTES,
      });
    } catch (error) {
      if (
        error instanceof PayloadValidationError &&
        error.code === "payload/string-too-large" &&
        error.field === "content"
      ) {
        throw new PayloadValidationError(
          "payload/string-too-large",
          `writeFile payload exceeds maximum size of ${MAX_WRITE_BYTES} bytes`,
          "content",
        );
      }
      throw error;
    }
    if (content === undefined) {
      throw new PayloadValidationError(
        "payload/missing-field",
        "writeFile payload must include content",
        "content",
      );
    }

    // Defense in depth: also reject when UTF-16 code-unit length exceeds the
    // cap. `getStringField` checks UTF-8 bytes; this catches multi-byte cases
    // where length is the binding constraint.
    if (content.length > MAX_WRITE_BYTES) {
      throw new PayloadValidationError(
        "payload/string-too-large",
        `writeFile payload exceeds maximum size of ${MAX_WRITE_BYTES} bytes`,
        "content",
      );
    }

    const roots = requireRoots(getWorkspaceRootPath);
    const authorizedPath = resolveInsideRoot(roots, filePath, {
      allowCreate: true,
    });

    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(authorizedPath), { recursive: true });
    await writeFile(authorizedPath, content, "utf-8");
  });

  handle(IPC_CHANNELS.fs.deleteFile, async (_event, payload) => {
    const filePath = requireStringField(payload, "path");
    const roots = requireRoots(getWorkspaceRootPath);
    const authorizedPath = resolveInsideRoot(roots, filePath);

    const { rm } = await import("node:fs/promises");
    await rm(authorizedPath, { recursive: true, force: true });
  });

  handle(IPC_CHANNELS.fs.renameFile, async (_event, payload) => {
    const oldPath = requireStringField(payload, "oldPath");
    const newPath = requireStringField(payload, "newPath");
    const roots = requireRoots(getWorkspaceRootPath);
    const resolvedOldPath = resolveInsideRoot(roots, oldPath);
    const resolvedNewPath = resolveInsideRoot(roots, newPath, {
      allowCreate: true,
    });

    const { rename } = await import("node:fs/promises");
    await rename(resolvedOldPath, resolvedNewPath);
  });

  handle(IPC_CHANNELS.fs.moveFile, async (_event, payload) => {
    const sourcePath = requireStringField(payload, "sourcePath");
    const destinationPath = requireStringField(payload, "destinationPath");
    const roots = requireRoots(getWorkspaceRootPath);
    const resolvedSource = resolveInsideRoot(roots, sourcePath);
    const resolvedDest = resolveInsideRoot(roots, destinationPath, {
      allowCreate: true,
    });

    const { mkdir, rename } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(resolvedDest), { recursive: true });
    await rename(resolvedSource, resolvedDest);
  });
}
