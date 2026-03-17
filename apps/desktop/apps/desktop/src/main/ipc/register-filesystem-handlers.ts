import { IPC_CHANNELS } from "@pidesk/shared";
import { getStringField } from "./payload-parsers";

export function registerFilesystemHandlers(
  handle: (
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ) => void,
) {
  handle(IPC_CHANNELS.fs.readDirectory, async (_event, payload) => {
    const dirPath = getStringField(payload, "path");
    if (!dirPath) {
      throw new Error("readDirectory payload must include path");
    }
    const { readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const result = entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => ({
        name: entry.name,
        path: join(dirPath, entry.name),
        type: entry.isDirectory() ? "directory" : "file",
        extension: entry.isFile() ? entry.name.split(".").pop() : undefined,
      }));
    return { path: dirPath, entries: result };
  });

  handle(IPC_CHANNELS.fs.readFile, async (_event, payload) => {
    const filePath = getStringField(payload, "path");
    if (!filePath) {
      throw new Error("readFile payload must include path");
    }
    const { readFileSync, statSync } = await import("node:fs");
    const { extname } = await import("node:path");

    const imageExtensions = new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
      ".ico",
    ]);
    const textExtensions = new Set([
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

    const ext = extname(filePath).toLowerCase();
    const isImage = imageExtensions.has(ext);
    const isText = textExtensions.has(ext) || (!ext && !isImage);

    if (isImage) {
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".bmp": "image/bmp",
        ".ico": "image/x-icon",
      };
      const mimeType = mimeTypes[ext] || "application/octet-stream";
      const buffer = readFileSync(filePath);
      const stats = statSync(filePath);
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

    try {
      const stats = statSync(filePath);
      const maxFileSize = 1024 * 1024;
      if (stats.size > maxFileSize) {
        return {
          path: filePath,
          content: "",
          type: "text" as const,
          encoding: "utf-8",
          truncated: true,
          size: stats.size,
        };
      }

      const buffer = readFileSync(filePath);
      for (let index = 0; index < Math.min(buffer.length, 8192); index += 1) {
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
    } catch (error) {
      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });

  handle(IPC_CHANNELS.fs.writeFile, async (_event, payload) => {
    const filePath = getStringField(payload, "path");
    const content = getStringField(payload, "content");
    if (!filePath) {
      throw new Error("writeFile payload must include path");
    }
    if (content === undefined) {
      throw new Error("writeFile payload must include content");
    }
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const maxWriteSize = 1024 * 1024;
    if (content.length > maxWriteSize) {
      console.warn(`Writing large file (${content.length} bytes): ${filePath}`);
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
  });
}

export default undefined;
