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
import type { GitRepositoryStatus } from "./git.js";
import type {
  InstalledPackageSnapshot,
  PackageCatalogDetail,
  PackageInstallRequest,
  PackageManagerStatus,
  PackageOperationSnapshot,
  PackageRemoveRequest,
  PackageSearchRequest,
  PackageSearchResponse,
  PackagesEvent,
  PackageUpdateRequest,
} from "./packages.js";
import type {
  AutocompleteContext,
  AutocompleteSuggestions,
  SearchRequest,
  SearchResponse,
} from "./search.js";
import type { ShellSnapshot } from "./shell.js";
import type { TerminalCreateOptions, TerminalSession } from "./terminal.js";
import type {
  CreateWindowAction,
  WindowLayoutState,
  WindowPosition,
  WorkspaceWindow,
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
    cancelPrompt(): Promise<void>;
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
    remove(repositoryId: string): Promise<void>;
    openInFinder(repositoryId: string): Promise<void>;
  };
  worktrees: {
    create(repositoryId: string, branchName: string): Promise<void>;
    select(worktreeId: string): Promise<void>;
  };
  threads: {
    create(worktreeId: string, title?: string): Promise<string>;
    select(threadId: string): Promise<void>;
    archive(threadId: string): Promise<void>;
    rename(threadId: string, title: string): Promise<void>;
  };
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
    openExternal(url: string): Promise<void>;
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
  git: {
    getRepositoryStatus(repositoryPath: string): Promise<GitRepositoryStatus>;
    stageFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    unstageFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    discardFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    commit(
      repositoryPath: string,
      message: string,
    ): Promise<GitRepositoryStatus>;
    pull(repositoryPath: string): Promise<GitRepositoryStatus>;
    push(repositoryPath: string): Promise<GitRepositoryStatus>;
  };
  packages: {
    getManagerStatus(): Promise<PackageManagerStatus>;
    searchCatalog(
      request: PackageSearchRequest,
    ): Promise<PackageSearchResponse>;
    getPackageDetail(packageName: string): Promise<PackageCatalogDetail>;
    listInstalled(
      scope?: "global" | "local",
    ): Promise<InstalledPackageSnapshot[]>;
    install(request: PackageInstallRequest): Promise<PackageOperationSnapshot>;
    remove(request: PackageRemoveRequest): Promise<PackageOperationSnapshot>;
    update(request: PackageUpdateRequest): Promise<PackageOperationSnapshot>;
    subscribe(listener: (event: PackagesEvent) => void): () => void;
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
    create(action: CreateWindowAction): Promise<WorkspaceWindow>;
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
