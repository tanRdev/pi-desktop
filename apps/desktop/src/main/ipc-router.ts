import {
  type AgentSnapshot,
  IPC_CHANNELS,
  type ProviderSnapshot,
  type SettingsSnapshot,
  type ShellSnapshot,
} from "@pidesk/shared";
import { dialog } from "electron";

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
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  agentHost,
}: RegisterIpcHandlersDependencies): void {
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
    const { readFileSync } = await import("node:fs");
    const { extname } = await import("node:path");

    // List of text file extensions we support
    const textExtensions = new Set([
      ".txt", ".md", ".markdown", ".json", ".yaml", ".yml", ".toml",
      ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
      ".py", ".rb", ".go", ".rs", ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".hpp",
      ".sh", ".bash", ".zsh", ".fish", ".ps1",
      ".html", ".htm", ".css", ".scss", ".sass", ".less",
      ".xml", ".svg", ".sql",
      ".env", ".gitignore", ".dockerignore", ".editorconfig",
      ".conf", ".config", ".cfg", ".ini",
      ".log", ".csv", ".tsv",
    ]);

    const ext = extname(filePath).toLowerCase();
    const isText = textExtensions.has(ext) || !ext; // Files without extension treated as text

    if (!isText) {
      return { path: filePath, content: "", type: "unsupported" as const };
    }

    try {
      const buffer = readFileSync(filePath);
      // Check for null bytes which indicate binary content
      for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
        if (buffer[i] === 0) {
          return { path: filePath, content: "", type: "binary" as const };
        }
      }
      const content = buffer.toString("utf-8");
      return { path: filePath, content, type: "text" as const, encoding: "utf-8" };
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });
}
