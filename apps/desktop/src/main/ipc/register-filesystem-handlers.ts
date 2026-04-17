import { IPC_CHANNELS } from "@pi-desktop/shared";
import { isPathWithin } from "../fs/path-guards";
import { getStringField } from "./payload-parsers";

interface RegisterFilesystemHandlersDependencies {
  handle: (
    channel: string,
    listener: (event?: unknown, payload?: unknown) => unknown,
  ) => void;
  getWorkspaceRootPath(): string | null;
}

export function registerFilesystemHandlers({
  handle,
  getWorkspaceRootPath,
}: RegisterFilesystemHandlersDependencies): void {
  async function authorizeAndResolveReadPath(userPath: string) {
    const workspaceRoot = getWorkspaceRootPath();
    if (!workspaceRoot) {
      throw new Error("readFile path is outside the workspace root");
    }

    const pathModule = await import("node:path");
    const fsModule = await import("node:fs");
    const resolvedRoot = pathModule.resolve(workspaceRoot);
    const resolvedTarget = pathModule.isAbsolute(userPath)
      ? pathModule.resolve(userPath)
      : pathModule.resolve(resolvedRoot, userPath);

    if (!isPathWithin(resolvedRoot, resolvedTarget)) {
      throw new Error("readFile path is outside the workspace root");
    }

    const realpathSync = fsModule.realpathSync.native ?? fsModule.realpathSync;
    try {
      return realpathSync(resolvedTarget);
    } catch {
      return resolvedTarget;
    }
  }

  async function authorizeAndResolveWritePath(userPath: string) {
    const workspaceRoot = getWorkspaceRootPath();
    if (!workspaceRoot) {
      throw new Error("writeFile path is outside the workspace root");
    }

    const pathModule = await import("node:path");
    const fsModule = await import("node:fs");
    const resolvedRoot = pathModule.resolve(workspaceRoot);
    const resolvedTarget = pathModule.isAbsolute(userPath)
      ? pathModule.resolve(userPath)
      : pathModule.resolve(resolvedRoot, userPath);

    if (!isPathWithin(resolvedRoot, resolvedTarget)) {
      throw new Error("writeFile path is outside the workspace root");
    }

    const realpathSync = fsModule.realpathSync.native ?? fsModule.realpathSync;

    // If the target already exists, use its canonical form so writes land on
    // the correct symlink-resolved file. The containment check above already
    // validated both the lexical and (when resolvable) canonical paths.
    try {
      return realpathSync(resolvedTarget);
    } catch {
      // Target does not exist yet; walk to the nearest existing ancestor and
      // verify it is still within the workspace root, defending against
      // symlinks that would push new files out of tree.
    }

    let parent = pathModule.dirname(resolvedTarget);
    let canonicalAncestor: string | null = null;
    while (true) {
      try {
        canonicalAncestor = realpathSync(parent);
        break;
      } catch {
        const next = pathModule.dirname(parent);
        if (next === parent) {
          break;
        }
        parent = next;
      }
    }

    if (!canonicalAncestor || !isPathWithin(resolvedRoot, canonicalAncestor)) {
      throw new Error("writeFile path is outside the workspace root");
    }

    return resolvedTarget;
  }

  handle(IPC_CHANNELS.fs.readDirectory, async (_event, payload) => {
    const dirPath = getStringField(payload, "path");
    if (!dirPath) {
      return {
        success: false,
        error: "readDirectory payload must include path",
      };
    }

    const workspaceRoot = getWorkspaceRootPath();
    if (!workspaceRoot) {
      return { success: false, error: "Workspace root is not configured" };
    }

    const pathModule = await import("node:path");
    const fsModule = await import("node:fs");
    const resolvedRoot = pathModule.resolve(workspaceRoot);
    const resolvedTarget = pathModule.isAbsolute(dirPath)
      ? pathModule.resolve(dirPath)
      : pathModule.resolve(resolvedRoot, dirPath);
    const realpathSync = fsModule.realpathSync.native ?? fsModule.realpathSync;

    let canonicalTarget: string;
    try {
      canonicalTarget = realpathSync(resolvedTarget);
    } catch {
      return {
        success: false,
        error: "readDirectory path is outside the workspace root",
      };
    }

    if (!isPathWithin(resolvedRoot, canonicalTarget)) {
      return {
        success: false,
        error: "readDirectory path is outside the workspace root",
      };
    }

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
  });

  handle(IPC_CHANNELS.fs.readFile, async (_event, payload) => {
    const filePath = getStringField(payload, "path");
    if (!filePath) {
      throw new Error("readFile payload must include path");
    }

    const authorizedPath = await authorizeAndResolveReadPath(filePath);
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

    const ext = extname(authorizedPath).toLowerCase();
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
      const buffer = readFileSync(authorizedPath);
      const stats = statSync(authorizedPath);
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
      const stats = statSync(authorizedPath);
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

      const buffer = readFileSync(authorizedPath);
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

    const authorizedPath = await authorizeAndResolveWritePath(filePath);
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    const maxWriteSize = 10 * 1024 * 1024;
    // `content` is UTF-16 JS length; a byte-accurate check would require
    // Buffer.byteLength. Enforce on both to reject cleanly either way.
    if (
      content.length > maxWriteSize ||
      Buffer.byteLength(content, "utf-8") > maxWriteSize
    ) {
      throw new Error(
        `writeFile payload exceeds maximum size of ${maxWriteSize} bytes`,
      );
    }
    await mkdir(dirname(authorizedPath), { recursive: true });
    await writeFile(authorizedPath, content, "utf-8");
  });

  handle(IPC_CHANNELS.fs.deleteFile, async (_event, payload) => {
    const filePath = getStringField(payload, "path");
    if (!filePath) {
      throw new Error("deleteFile payload must include path");
    }

    const authorizedPath = await authorizeAndResolveWritePath(filePath);
    const { rm } = await import("node:fs/promises");
    await rm(authorizedPath, { recursive: true, force: true });
  });

  handle(IPC_CHANNELS.fs.renameFile, async (_event, payload) => {
    const oldPath = getStringField(payload, "oldPath");
    const newPath = getStringField(payload, "newPath");
    if (!oldPath) {
      throw new Error("renameFile payload must include oldPath");
    }
    if (!newPath) {
      throw new Error("renameFile payload must include newPath");
    }

    const resolvedOldPath = await authorizeAndResolveWritePath(oldPath);
    const resolvedNewPath = await authorizeAndResolveWritePath(newPath);
    const { rename } = await import("node:fs/promises");
    await rename(resolvedOldPath, resolvedNewPath);
  });

  handle(IPC_CHANNELS.fs.moveFile, async (_event, payload) => {
    const sourcePath = getStringField(payload, "sourcePath");
    const destinationPath = getStringField(payload, "destinationPath");
    if (!sourcePath) {
      throw new Error("moveFile payload must include sourcePath");
    }
    if (!destinationPath) {
      throw new Error("moveFile payload must include destinationPath");
    }

    const resolvedSource = await authorizeAndResolveWritePath(sourcePath);
    const resolvedDest = await authorizeAndResolveWritePath(destinationPath);
    const { mkdir, rename } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(resolvedDest), { recursive: true });
    await rename(resolvedSource, resolvedDest);
  });
}
