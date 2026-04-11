import {
  type AgentSnapshot,
  type AutocompleteContext,
  type AutocompleteSuggestions,
  IPC_CHANNELS,
  type ModelSwitchRequest,
  type PiDiscoveryResult,
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
import type { GitWorktreeService } from "./git-worktree-service";
import type { PackagesService } from "./packages/packages-service";
import { registerDialogHandlers } from "./ipc/register-dialog-handlers";
import { registerFilesystemHandlers } from "./ipc/register-filesystem-handlers";
import { registerGitHandlers } from "./ipc/register-git-handlers";
import { registerRepositoryHandlers } from "./ipc/register-repository-handlers";
import {
  registerStateHandlers,
  type StateIpcHost,
} from "./ipc/register-state-handlers";
import { registerTerminalHandlers } from "./ipc/register-terminal-handlers";
import { registerThreadHandlers } from "./ipc/register-thread-handlers";
import { terminalManager } from "./terminal-manager";
import type { ThreadCatalog } from "./thread-catalog";

export interface AgentIpcHost {
  getProviders(): Promise<ProviderSnapshot[]>;
  getSettings(): Promise<SettingsSnapshot>;
  getSnapshot(): Promise<AgentSnapshot>;
  prompt(text: string): Promise<void>;
  cancelPrompt(): Promise<void>;
  reset(): Promise<void>;
  addRepository(path: string): Promise<void>;
  reorderRepositories(repositoryIds: string[]): Promise<void>;
  selectRepository(repositoryId: string): Promise<void>;
  removeRepository(repositoryId: string): Promise<void>;
  openRepositoryInFinder(repositoryId: string): Promise<void>;
  createWorktree(repositoryId: string, branchName: string): Promise<void>;
  selectWorktree(worktreeId: string): Promise<void>;
  createThread(worktreeId: string, title?: string): Promise<string>;
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
  getWorkspaceRootPath?(): string | null;
  agentHost: AgentIpcHost;
  stateHost?: StateIpcHost;
  mainWindow: BrowserWindow | null;
  terminalManager?: typeof terminalManager;
  gitService?: GitWorktreeService;
  searchFiles?(request: SearchRequest): Promise<SearchResponse>;
  switchModel?(request: ModelSwitchRequest): Promise<void>;
  getDiscovery?(): Promise<PiDiscoveryResult>;
  getSlashSuggestions?(
    context: AutocompleteContext,
  ): Promise<AutocompleteSuggestions>;
  threadCatalog?: ThreadCatalog;
  packagesService?: PackagesService;
}

export function registerIpcHandlers({
  handle,
  getShellSnapshot,
  getWorkspaceRootPath,
  agentHost,
  stateHost,
  mainWindow,
  terminalManager: terminalManagerOverride,
  gitService,
  searchFiles,
  switchModel,
  getDiscovery,
  getSlashSuggestions,
  threadCatalog,
  packagesService,
}: RegisterIpcHandlersDependencies): void {
  const tm = terminalManagerOverride ?? terminalManager;

  registerTerminalHandlers({ handle, mainWindow, terminalManager: tm });
  registerRepositoryHandlers({ handle, agentHost });
  registerThreadHandlers({ handle, agentHost, threadCatalog });
  registerDialogHandlers({ handle });
  registerFilesystemHandlers({
    handle,
    getWorkspaceRootPath: () => getWorkspaceRootPath?.() ?? null,
  });
  registerStateHandlers({ handle, stateHost });
  if (gitService) {
    registerGitHandlers({ handle, gitService });
  }

  handle(IPC_CHANNELS.packages.getManagerStatus, async () => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    return packagesService.getManagerStatus();
  });

  handle(IPC_CHANNELS.packages.searchCatalog, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const query = getStringField(payload, "query") ?? "";
    const sort = getStringField(payload, "sort") ?? "downloads";
    const payloadKinds =
      typeof payload === "object" && payload !== null && "kinds" in payload
        ? (payload as { kinds?: unknown }).kinds
        : undefined;
    const kinds = Array.isArray(payloadKinds)
      ? payloadKinds.filter(
          (value): value is "extension" | "skill" | "theme" | "prompt" =>
            value === "extension" ||
            value === "skill" ||
            value === "theme" ||
            value === "prompt",
        )
      : [];
    const hasDemoOnly =
      typeof payload === "object" &&
      payload !== null &&
      "hasDemoOnly" in payload
        ? typeof (payload as { hasDemoOnly?: unknown }).hasDemoOnly ===
          "boolean"
          ? (payload as { hasDemoOnly: boolean }).hasDemoOnly
          : undefined
        : undefined;

    return packagesService.searchCatalog({
      query,
      sort:
        sort === "recent" || sort === "name" || sort === "downloads"
          ? sort
          : "downloads",
      kinds,
      hasDemoOnly,
    });
  });

  handle(IPC_CHANNELS.packages.getPackageDetail, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const packageName = getStringField(payload, "packageName");
    if (!packageName) {
      throw new Error("Package detail payload must include packageName");
    }

    return packagesService.getPackageDetail(packageName);
  });

  handle(IPC_CHANNELS.packages.listInstalled, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const scope = getStringField(payload, "scope");
    return packagesService.listInstalled(
      scope === "global" || scope === "local" ? scope : undefined,
    );
  });

  handle(IPC_CHANNELS.packages.install, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const packageName = getStringField(payload, "packageName");
    const scope = getStringField(payload, "scope");
    if (!packageName || (scope !== "global" && scope !== "local")) {
      throw new Error("Install payload must include packageName and scope");
    }

    return packagesService.install({ packageName, scope });
  });

  handle(IPC_CHANNELS.packages.remove, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const packageName = getStringField(payload, "packageName");
    const scope = getStringField(payload, "scope");
    if (!packageName || (scope !== "global" && scope !== "local")) {
      throw new Error("Remove payload must include packageName and scope");
    }

    return packagesService.remove({ packageName, scope });
  });

  handle(IPC_CHANNELS.packages.update, async (_event, payload) => {
    if (!packagesService) {
      throw new Error("Packages service is unavailable");
    }

    const packageName = getStringField(payload, "packageName");
    const scope = getStringField(payload, "scope");
    if (scope !== "global" && scope !== "local") {
      throw new Error("Update payload must include scope");
    }

    return packagesService.update({ packageName, scope });
  });

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

  handle(IPC_CHANNELS.agent.cancelPrompt, async () => {
    await agentHost.cancelPrompt();
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

  handle(
    IPC_CHANNELS.window.getFullscreenState,
    async () => mainWindow?.isFullScreen() ?? false,
  );
}
