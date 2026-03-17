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
} from "@pidesk/shared";
import type { BrowserWindow } from "electron";
import {
  getNumberField,
  getStringField,
  parseSearchRequest,
} from "./ipc/payload-parsers";
import { registerDialogHandlers } from "./ipc/register-dialog-handlers";
import { registerFilesystemHandlers } from "./ipc/register-filesystem-handlers";
import { registerRepositoryHandlers } from "./ipc/register-repository-handlers";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers";
import { registerThreadHandlers } from "./ipc/register-thread-handlers";
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

  registerTerminalHandlers({ handle, mainWindow, terminalManager: tm });
  registerRepositoryHandlers({ handle, agentHost });
  registerThreadHandlers({ handle, agentHost, routeToTerminal });
  registerDialogHandlers({ handle });
  registerFilesystemHandlers({ handle, getShellSnapshot });

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
}
