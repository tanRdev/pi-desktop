import {
  type AgentSnapshot,
  type AutocompleteContext,
  type AutocompleteSuggestions,
  IPC_CHANNELS,
  type ModelSwitchRequest,
  type PiDiscoveryResult,
  type PiTerminalRouteRequest,
  type PiTerminalRouteResult,
  type ProviderSnapshot,
  type SearchRequest,
  type SearchResponse,
  type SettingsSnapshot,
  type ShellSnapshot,
  type TerminalCreateOptions,
} from "@pidesk/shared";
import { type BrowserWindow, dialog } from "electron";
import { terminalManager } from "./terminal-manager";

export interface AgentIpcHost {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  reset(): Promise<void>;
  addRepository(path: string): Promise<void>;
  selectRepository(repositoryId: string): Promise<void>;
  createWorktree(repositoryId: string, branchName: string): Promise<void>;
  selectWorktree(worktreeId: string): Promise<void>;
  createThread(worktreeId: string, title?: string): Promise<void>;
  selectThread(threadId: string): Promise<void>;
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
  getShellSnapshot(): Promise<ShellSnapshot> | ShellSnapshot;
  agentHost: AgentIpcHost;
  mainWindow: BrowserWindow | null;
  terminalManager?: typeof terminalManager;
  searchFiles?(request: SearchRequest): Promise<SearchResponse>;
  switchModel?(request: ModelSwitchRequest): Promise<void>;
  getDiscovery?(): Promise<PiDiscoveryResult>;
  getSlashSuggestions?(
    context: AutocompleteContext,
  ): Promise<AutocompleteSuggestions>;
  routeToTerminal?(
    request: PiTerminalRouteRequest,
  ): Promise<PiTerminalRouteResult>;
}

function isPayloadRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(payload: unknown, key: string): string | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberField(payload: unknown, key: string): number | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }
  const value = payload[key];
  return typeof value === "number" ? value : undefined;
}

function getBooleanField(payload: unknown, key: string): boolean | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }
  const value = payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function getStringArrayField(
  payload: unknown,
  key: string,
): string[] | undefined {
  if (!isPayloadRecord(payload)) {
    return undefined;
  }
  const value = payload[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseDialogOptions(payload: unknown): Electron.OpenDialogOptions {
  const options: Electron.OpenDialogOptions = {};
  const title = getStringField(payload, "title");
  if (title) {
    options.title = title;
  }

  const properties = getStringArrayField(payload, "properties");
  if (properties) {
    options.properties = properties.filter(
      (
        property,
      ): property is NonNullable<
        Electron.OpenDialogOptions["properties"]
      >[number] =>
        property === "openFile" ||
        property === "openDirectory" ||
        property === "multiSelections" ||
        property === "showHiddenFiles" ||
        property === "createDirectory" ||
        property === "promptToCreate" ||
        property === "noResolveAliases" ||
        property === "treatPackageAsDirectory" ||
        property === "dontAddToRecent",
    );
  }

  return options;
}

function parseSearchRequest(payload: unknown): SearchRequest | null {
  const query = getStringField(payload, "query");
  const rootPath = getStringField(payload, "rootPath");
  if (!query || !rootPath) {
    return null;
  }

  return {
    query,
    rootPath,
    maxResults: getNumberField(payload, "maxResults"),
    includePatterns: getStringArrayField(payload, "includePatterns"),
    excludePatterns: getStringArrayField(payload, "excludePatterns"),
  };
}

function parseTerminalCreateOptions(
  payload: unknown,
): TerminalCreateOptions | null {
  const id = getStringField(payload, "id");
  const cols = getNumberField(payload, "cols");
  const rows = getNumberField(payload, "rows");
  const ownerWindowId = getStringField(payload, "ownerWindowId");
  if (
    !id ||
    typeof cols !== "number" ||
    typeof rows !== "number" ||
    !ownerWindowId
  ) {
    return null;
  }

  const backend = getStringField(payload, "backend");

  return {
    id,
    cols,
    rows,
    ownerWindowId,
    cwd: getStringField(payload, "cwd"),
    backend:
      backend === "shell" ||
      backend === "lazygit" ||
      backend === "pi-linked" ||
      backend === "tmux-attach"
        ? backend
        : undefined,
    linkedThreadId: getStringField(payload, "linkedThreadId"),
  };
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  agentHost,
  mainWindow,
  terminalManager: terminalManagerOverride,
  searchFiles,
  switchModel,
  getDiscovery,
  getSlashSuggestions,
  routeToTerminal,
}: RegisterIpcHandlersDependencies): void {
  const tm = terminalManagerOverride ?? terminalManager;

  if (mainWindow) {
    tm.setMainWindow(mainWindow);
  }
  tm.initialize();

  handle(IPC_CHANNELS.shell.getSnapshot, async () => getShellSnapshot());
  handle(IPC_CHANNELS.agent.getProviders, async () => agentHost.getProviders());
  handle(IPC_CHANNELS.agent.getSettings, async () => agentHost.getSettings());
  handle(IPC_CHANNELS.agent.getSnapshot, async () => agentHost.getSnapshot());

  handle(IPC_CHANNELS.agent.switchModel, async (_event, payload) => {
    if (!switchModel) {
      throw new Error("Model switching is unavailable");
    }
    const providerId = getStringField(payload, "providerId");
    const modelId = getStringField(payload, "modelId");
    if (!providerId || !modelId) {
      throw new Error(
        "Model switch payload must include providerId and modelId",
      );
    }
    await switchModel({ providerId, modelId });
  });

  handle(IPC_CHANNELS.agent.getDiscovery, async () =>
    getDiscovery
      ? getDiscovery()
      : { isInstalled: false, skills: [], commands: [] },
  );

  handle(IPC_CHANNELS.agent.getSlashSuggestions, async (_event, payload) => {
    if (!getSlashSuggestions) {
      return {
        kind: "slash",
        suggestions: [],
        hasMore: false,
      } satisfies AutocompleteSuggestions;
    }

    const text = getStringField(payload, "text");
    const cursorPosition = getNumberField(payload, "cursorPosition");
    const query = getStringField(payload, "query");
    const trigger = getStringField(payload, "trigger");
    if (!text || typeof cursorPosition !== "number" || query === undefined) {
      throw new Error(
        "Slash suggestions payload must include text, cursorPosition, and query",
      );
    }

    return getSlashSuggestions({
      text,
      cursorPosition,
      query,
      trigger: trigger === "/" || trigger === "@" ? trigger : undefined,
    });
  });

  handle(IPC_CHANNELS.repositories.add, async (_event, payload) => {
    const repositoryPath = getStringField(payload, "path");
    if (!repositoryPath) {
      throw new Error("Repository add payload must include path");
    }
    await agentHost.addRepository(repositoryPath);
  });

  handle(IPC_CHANNELS.repositories.select, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    if (!repositoryId) {
      throw new Error("Repository select payload must include repositoryId");
    }
    await agentHost.selectRepository(repositoryId);
  });

  handle(IPC_CHANNELS.worktrees.create, async (_event, payload) => {
    const repositoryId = getStringField(payload, "repositoryId");
    const branchName = getStringField(payload, "branchName");
    if (!repositoryId || !branchName) {
      throw new Error(
        "Worktree create payload must include repositoryId and branchName",
      );
    }
    await agentHost.createWorktree(repositoryId, branchName);
  });

  handle(IPC_CHANNELS.worktrees.select, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    if (!worktreeId) {
      throw new Error("Worktree select payload must include worktreeId");
    }
    await agentHost.selectWorktree(worktreeId);
  });

  handle(IPC_CHANNELS.threads.create, async (_event, payload) => {
    const worktreeId = getStringField(payload, "worktreeId");
    const title = getStringField(payload, "title");
    if (!worktreeId) {
      throw new Error("Thread create payload must include worktreeId");
    }
    await agentHost.createThread(worktreeId, title);
  });

  handle(IPC_CHANNELS.threads.select, async (_event, payload) => {
    const threadId = getStringField(payload, "threadId");
    if (!threadId) {
      throw new Error("Thread select payload must include threadId");
    }
    await agentHost.selectThread(threadId);
  });

  handle(IPC_CHANNELS.threads.routeToTerminal, async (_event, payload) => {
    if (!routeToTerminal) {
      return {
        success: false,
        error: "Terminal routing is unavailable",
      } satisfies PiTerminalRouteResult;
    }

    const terminalId = getStringField(payload, "terminalId");
    const prompt = getStringField(payload, "prompt");
    const startPiIfNotLinked =
      getBooleanField(payload, "startPiIfNotLinked") ?? false;
    if (!terminalId || prompt === undefined) {
      throw new Error(
        "Terminal routing payload must include terminalId and prompt",
      );
    }
    return routeToTerminal({ terminalId, prompt, startPiIfNotLinked });
  });

  handle(IPC_CHANNELS.agent.prompt, async (_event, payload) => {
    const text = getStringField(payload, "text");
    if (!text || text.length === 0) {
      throw new Error("Agent prompt payload must include text");
    }
    await agentHost.prompt(text);
  });

  handle(IPC_CHANNELS.agent.reset, async () => {
    await agentHost.reset();
  });

  handle(IPC_CHANNELS.dialog.showOpenDialog, async (_event, payload) => {
    const result = await dialog.showOpenDialog(parseDialogOptions(payload));
    return result.canceled ? null : result.filePaths;
  });

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

  handle(IPC_CHANNELS.search.searchFiles, async (_event, payload) => {
    if (!searchFiles) {
      throw new Error("Workspace search is unavailable");
    }
    const request = parseSearchRequest(payload);
    if (!request) {
      throw new Error("searchFiles payload must include query and rootPath");
    }
    return searchFiles(request);
  });

  handle(IPC_CHANNELS.terminal.create, async (_event, payload) => {
    const options = parseTerminalCreateOptions(payload);
    if (!options) {
      throw new Error("terminal.create payload must include id, cols, rows");
    }
    if (!tm.isAvailable()) {
      const error = tm.getError();
      throw new Error(error?.message || "Terminal is not available");
    }
    return tm.create(options.id ?? "", options);
  });

  handle(IPC_CHANNELS.terminal.getSessions, async () => tm.getSessions());

  handle(IPC_CHANNELS.terminal.write, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const data = getStringField(payload, "data");
    if (!id || data === undefined) {
      throw new Error("terminal.write payload must include id and data");
    }
    tm.write(id, data);
  });

  handle(IPC_CHANNELS.terminal.resize, async (_event, payload) => {
    const id = getStringField(payload, "id");
    const cols = getNumberField(payload, "cols");
    const rows = getNumberField(payload, "rows");
    if (!id || typeof cols !== "number" || typeof rows !== "number") {
      throw new Error("terminal.resize payload must include id, cols, rows");
    }
    tm.resize(id, cols, rows);
  });

  handle(IPC_CHANNELS.terminal.destroy, async (_event, payload) => {
    const id = getStringField(payload, "id");
    if (!id) {
      throw new Error("terminal.destroy payload must include id");
    }
    tm.destroy(id);
  });
}
