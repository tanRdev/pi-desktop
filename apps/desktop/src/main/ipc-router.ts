import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ProviderSnapshot,
  type SettingsSnapshot,
  type ShellSnapshot,
} from "@pidesk/shared";
import { type BrowserWindow, dialog } from "electron";
import { terminalManager } from "./terminal-manager";
export interface AgentIpcHost {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  reset(): Promise<void>;
  switchWorkspace(path: string): Promise<void>;
}

export interface IpcRegistrar {
  handle(
    channel: string,
    listener: (
      event?: unknown,
      payload?: unknown,
    ) => Promise<unknown> | unknown,
  ): void;
}

export interface RegisterIpcHandlersDependencies {
  handle: IpcRegistrar["handle"];
  getShellSnapshot(): ShellSnapshot;
  agentHost: AgentIpcHost;
  mainWindow: BrowserWindow | null;
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  agentHost,
  mainWindow,
}: RegisterIpcHandlersDependencies): void {
  if (mainWindow) {
    terminalManager.setMainWindow(mainWindow);
  }
  // Initialize terminal manager (loads native module)
  terminalManager.initialize();
  handle(IPC_CHANNELS.shell.getSnapshot, async () => getShellSnapshot());
  handle(IPC_CHANNELS.agent.getProviders, async () => agentHost.getProviders());
  handle(IPC_CHANNELS.agent.getSettings, async () => agentHost.getSettings());
  handle(IPC_CHANNELS.agent.getSnapshot, async () => agentHost.getSnapshot());
  handle(IPC_CHANNELS.agent.switchWorkspace, async (_event, payload) => {
    const path =
      typeof payload === "object" && payload !== null && "path" in payload
        ? payload.path
        : undefined;
    if (typeof path === "string") {
      await agentHost.switchWorkspace(path);
    }
  });
  handle(IPC_CHANNELS.agent.prompt, async (_event, payload) => {
    const text =
      typeof payload === "object" && payload !== null && "text" in payload
        ? payload.text
        : undefined;

    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Agent prompt payload must include text");
    }

    await agentHost.prompt(text);
  });
  handle(IPC_CHANNELS.agent.reset, async () => {
    await agentHost.reset();
  });
  handle(IPC_CHANNELS.dialog.showOpenDialog, async (_event, payload) => {
    const options = payload as Electron.OpenDialogOptions;
    const result = await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths;
  });
  handle(IPC_CHANNELS.fs.readDirectory, async (_event, payload) => {
    const dirPath =
      typeof payload === "object" && payload !== null && "path" in payload
        ? payload.path
        : undefined;
    if (typeof dirPath !== "string") {
      throw new Error("readDirectory payload must include path");
    }
    const { readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const result = entries
      .filter((entry) => !entry.name.startsWith("."))
      .sort((a, b) => {
        // Directories first, then files, alphabetically within each group
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
    const filePath =
      typeof payload === "object" && payload !== null && "path" in payload
        ? payload.path
        : undefined;
    if (typeof filePath !== "string") {
      throw new Error("readFile payload must include path");
    }
    const { readFileSync, statSync } = await import("node:fs");
    const { extname } = await import("node:path");

    // List of text file extensions we support
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

      // 1MB size limit for text files
      const MAX_FILE_SIZE = 1024 * 1024;
      if (stats.size > MAX_FILE_SIZE) {
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
      // Check for null bytes which indicate binary content
      for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
        if (buffer[i] === 0) {
          return {
            path: filePath,
            content: "",
            type: "binary" as const,
            size: stats.size,
          };
        }
      }
      const content = buffer.toString("utf-8");
      return {
        path: filePath,
        content,
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
    const filePath =
      typeof payload === "object" && payload !== null && "path" in payload
        ? payload.path
        : undefined;
    const content =
      typeof payload === "object" && payload !== null && "content" in payload
        ? payload.content
        : undefined;

    if (typeof filePath !== "string") {
      throw new Error("writeFile payload must include path");
    }
    if (typeof content !== "string") {
      throw new Error("writeFile payload must include content");
    }

    const { writeFile } = await import("node:fs/promises");

    // Warn about large files (>1MB)
    const MAX_WRITE_SIZE = 1024 * 1024;
    if (content.length > MAX_WRITE_SIZE) {
      console.warn(`Writing large file (${content.length} bytes): ${filePath}`);
    }

    await writeFile(filePath, content, "utf-8");
  });

  // Terminal handlers
  handle(IPC_CHANNELS.terminal.create, async (_event, payload) => {
    const opts = payload as {
      id: string;
      cols: number;
      rows: number;
      cwd?: string;
    };
    if (
      !opts.id ||
      typeof opts.cols !== "number" ||
      typeof opts.rows !== "number"
    ) {
      throw new Error("terminal.create payload must include id, cols, rows");
    }
    if (!terminalManager.isAvailable()) {
      const error = terminalManager.getError();
      throw new Error(error?.message || "Terminal is not available");
    }
    terminalManager.create(opts.id, {
      cols: opts.cols,
      rows: opts.rows,
      cwd: opts.cwd,
    });
    return { id: opts.id };
  });
  handle(IPC_CHANNELS.terminal.write, async (_event, payload) => {
    const opts = payload as { id: string; data: string };
    if (!opts.id || typeof opts.data !== "string") {
      throw new Error("terminal.write payload must include id and data");
    }
    terminalManager.write(opts.id, opts.data);
  });

  handle(IPC_CHANNELS.terminal.resize, async (_event, payload) => {
    const opts = payload as { id: string; cols: number; rows: number };
    if (
      !opts.id ||
      typeof opts.cols !== "number" ||
      typeof opts.rows !== "number"
    ) {
      throw new Error("terminal.resize payload must include id, cols, rows");
    }
    terminalManager.resize(opts.id, opts.cols, opts.rows);
  });

  handle(IPC_CHANNELS.terminal.destroy, async (_event, payload) => {
    const opts = payload as { id: string };
    if (!opts.id) {
      throw new Error("terminal.destroy payload must include id");
    }
    terminalManager.destroy(opts.id);
  });
}
