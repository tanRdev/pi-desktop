import type {
  AgentSnapshot,
  ModelSwitchRequest,
  OAuthProviderSnapshot,
  PiDesktopAgentEvent,
  PiDiscoveryResult,
  ProviderSnapshot,
  SettingsSnapshot,
} from "./agent.js";
import type { OpenDialogOptions } from "./dialog.js";
import type { DirectoryListing, FileContent } from "./fs.js";
import type { GitFileDiff, GitRepositoryStatus } from "./git.js";
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
  AppPreferences,
  LegacyPreferencesImport,
  RepositoryDisplayMetadata,
  RepositoryPreferences,
  WorkspaceSession,
} from "./workspace-session.js";

export interface PiDesktopApi {
  shell: {
    getSnapshot(): Promise<ShellSnapshot>;
  };
  agent: {
    getProviders(): Promise<ProviderSnapshot[]>;
    getSettings(): Promise<SettingsSnapshot>;
    getSnapshot(): Promise<AgentSnapshot>;
    getOAuthProviders(): Promise<OAuthProviderSnapshot[]>;
    loginWithOAuth(providerId: string): Promise<void>;
    logoutOAuth(providerId: string): Promise<void>;
    prompt(text: string): Promise<void>;
    cancelPrompt(): Promise<void>;
    reset(): Promise<void>;
    switchModel(request: ModelSwitchRequest): Promise<void>;
    getDiscovery(): Promise<PiDiscoveryResult>;
    getSlashSuggestions(
      context: AutocompleteContext,
    ): Promise<AutocompleteSuggestions>;
    subscribe(listener: (event: PiDesktopAgentEvent) => void): () => void;
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
    remove(worktreeId: string): Promise<void>;
  };
  threads: {
    create(worktreeId: string): Promise<string>;
    select(threadId: string): Promise<void>;
    delete(threadId: string): Promise<void>;
  };
  dialog: {
    showOpenDialog(options: OpenDialogOptions): Promise<string[] | null>;
    openExternal(url: string): Promise<void>;
  };
  fs: {
    readDirectory(path: string): Promise<DirectoryListing>;
    readFile(path: string): Promise<FileContent>;
    writeFile(path: string, content: string): Promise<void>;
    deleteFile(path: string): Promise<void>;
    renameFile(oldPath: string, newPath: string): Promise<void>;
    moveFile(sourcePath: string, destinationPath: string): Promise<void>;
  };
  git: {
    getRepositoryStatus(
      repositoryPath: string,
      options?: { force?: boolean },
    ): Promise<GitRepositoryStatus>;
    isRepository(targetPath: string): Promise<boolean>;
    init(targetPath: string): Promise<void>;
    diffFile(
      repositoryPath: string,
      filePath: string,
      staged: boolean,
    ): Promise<GitFileDiff>;
    stageFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    stageFiles(
      repositoryPath: string,
      filePaths: string[],
    ): Promise<GitRepositoryStatus>;
    unstageFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    unstageFiles(
      repositoryPath: string,
      filePaths: string[],
    ): Promise<GitRepositoryStatus>;
    discardFile(
      repositoryPath: string,
      filePath: string,
    ): Promise<GitRepositoryStatus>;
    commit(
      repositoryPath: string,
      message: string,
    ): Promise<GitRepositoryStatus>;
    fetch(repositoryPath: string): Promise<GitRepositoryStatus>;
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
    getFullscreenState(): Promise<boolean>;
    onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void;
  };
  clipboard: {
    writeText(text: string): Promise<void>;
  };
}
