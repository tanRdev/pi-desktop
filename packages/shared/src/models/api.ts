import type {
  AgentSnapshot,
  ModelSwitchRequest,
  PiDeskAgentEvent,
  PiDiscoveryResult,
  ProviderSnapshot,
  SettingsSnapshot,
} from "./agent.js";
import type { OpenDialogOptions } from "./dialog.js";
import type {
  DirectoryListing,
  FileContent,
  ImageMetadata,
  ImagePreview,
  ImagePreviewOptions,
} from "./fs.js";
import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  SearchRequest,
  SearchResponse,
} from "./search.js";
import type { ShellSnapshot } from "./shell.js";
import type {
  PiTerminalRouteRequest,
  PiTerminalRouteResult,
  TerminalCreateOptions,
  TerminalSession,
} from "./terminal.js";
import type {
  CanvasWindow,
  CreateWindowAction,
  WindowLayoutState,
  WindowPosition,
} from "./window.js";
import type {
  AppPreferences,
  LegacyPreferencesImport,
  RepositoryDisplayMetadata,
  RepositoryPreferences,
  WorkspaceSession,
} from "./workspace-session.js";

export interface PiDeskApi {
  shell: {
    getSnapshot(): Promise<ShellSnapshot>;
  };
  agent: {
    getProviders(): Promise<ProviderSnapshot[]>;
    getSettings(): Promise<SettingsSnapshot>;
    getSnapshot(): Promise<AgentSnapshot>;
    prompt(text: string): Promise<void>;
    reset(): Promise<void>;
    switchModel(request: ModelSwitchRequest): Promise<void>;
    getDiscovery(): Promise<PiDiscoveryResult>;
    getSlashSuggestions(
      context: AutocompleteContext,
    ): Promise<AutocompleteSuggestions>;
    subscribe(listener: (event: PiDeskAgentEvent) => void): () => void;
  };
  repositories: {
    add(path: string): Promise<void>;
    reorder(repositoryIds: string[]): Promise<void>;
    select(repositoryId: string): Promise<void>;
  };
  worktrees: {
    create(repositoryId: string, branchName: string): Promise<void>;
    select(worktreeId: string): Promise<void>;
  };
  threads: {
    create(worktreeId: string, title?: string): Promise<void>;
    select(threadId: string): Promise<void>;
    archive(threadId: string): Promise<void>;
    rename(threadId: string, title: string): Promise<void>;
    routeToTerminal(
      request: PiTerminalRouteRequest,
    ): Promise<PiTerminalRouteResult>;
  };
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
  };
  fs: {
    readDirectory(path: string): Promise<DirectoryListing>;
    readFile(path: string): Promise<FileContent>;
    writeFile(path: string, content: string): Promise<void>;
    getImageMetadata(path: string): Promise<ImageMetadata>;
    getImagePreview(
      path: string,
      options?: ImagePreviewOptions,
    ): Promise<ImagePreview>;
  };
  terminal: {
    create(options: TerminalCreateOptions): Promise<TerminalSession>;
    write(id: string, data: string): Promise<void>;
    resize(id: string, cols: number, rows: number): Promise<void>;
    destroy(id: string): Promise<void>;
    getSessions(): Promise<TerminalSession[]>;
    onEvent(
      listener: (event: {
        type: string;
        id: string;
        data?: string;
        exitCode?: number;
      }) => void,
    ): () => void;
  };
  search: {
    searchFiles(request: SearchRequest): Promise<SearchResponse>;
  };
  state: {
    getRepositoryPreferences(
      repositoryId: string,
    ): Promise<RepositoryPreferences | null>;
    updateRepositoryPreferences(
      repositoryId: string,
      updates: Partial<RepositoryDisplayMetadata>,
    ): Promise<RepositoryPreferences>;
    getWorkspaceSession(worktreeId: string): Promise<WorkspaceSession | null>;
    saveWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession>;
    getAppPreferences(): Promise<AppPreferences>;
    updateAppPreferences(
      updates: Partial<AppPreferences>,
    ): Promise<AppPreferences>;
    importLegacyPreferences(importData: LegacyPreferencesImport): Promise<{
      repositoryPreferences: RepositoryPreferences[];
      appPreferences: AppPreferences;
    }>;
  };
  window: {
    create(action: CreateWindowAction): Promise<CanvasWindow>;
    close(windowId: string): Promise<void>;
    focus(windowId: string): Promise<void>;
    getFullscreenState(): Promise<boolean>;
    onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void;
    move(windowId: string, position: WindowPosition): Promise<void>;
    resize(windowId: string, position: WindowPosition): Promise<void>;
    minimize(windowId: string): Promise<void>;
    maximize(windowId: string): Promise<void>;
    restore(windowId: string): Promise<void>;
    getLayout(): Promise<WindowLayoutState>;
  };
}
