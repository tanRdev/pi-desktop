import type {
  GitRepositoryStatus,
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  ShellGitSnapshot,
  SlashSuggestion,
} from "@pidesk/shared";
import type { AgentLiveFeed } from "@pidesk/shell-model";
import * as React from "react";
import { SidebarSimple, SquaresFour } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { ChatThreadPanel } from "./chat-thread-panel";
import { GitPanel } from "./git-panel";
import { LeftRail, SIDEBAR_WIDTH } from "./left-rail";
import { PromptDock } from "./prompt-dock";
import { WorkspaceActivityPanel } from "./workspace-activity-panel";
import { FileTreeOverlay, LauncherOverlay } from "./workspace-overlays";
import type { WorkspaceSearchAction } from "./workspace-search-content";
import { WorkspaceSurfacePanel } from "./workspace-surface-panel";

type ContextSurfaceKey = "activity" | string;
type ContextWindow = Extract<
  import("@pidesk/shared").WorkspaceWindow,
  { kind: "file" | "terminal" | "git" }
>;
type PromptMode = "build" | "plan";

export interface WorkspaceShellProps {
  platform: string | null;
  repositories: RepositorySnapshot[];
  activeRepository: RepositorySnapshot | null;
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  draft: string;
  canSend: boolean;
  autocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  autocompleteSelectedIndex: number;
  displayAgentStatus: string;
  runtimeModeLabel: string;
  providerSnapshots: ProviderSnapshot[];
  currentModelValue: string;
  isSwitchingModel: boolean;
  isLauncherOpen: boolean;
  isFileTreeOpen: boolean;
  isPromptVisible: boolean;
  isPromptExecuting: boolean;
  launcherQuery: string;
  launcherResults: import("@pidesk/shared").SearchMatch[];
  launcherSelectedIndex: number;
  launcherIsLoading: boolean;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  shellGit: ShellGitSnapshot | null;
  gitCommitMessage: string;
  threadMessages: import("@pidesk/shared").AgentMessageSnapshot[];
  threadLastError: string | null;
  liveFeed: AgentLiveFeed;
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
  leftRailWidth: number;
  onSelectContextSurface: (surfaceKey: ContextSurfaceKey) => void;
  onLeftRailResize: (width: number) => void;
  onModelMenuOpenChange: (open: boolean) => void | Promise<void>;
  onAddRepository: () => void | Promise<void>;
  onSelectRepository: (repositoryId: string) => void | Promise<void>;
  onRenameRepository: (
    repositoryId: string,
    name: string,
  ) => void | Promise<void>;
  onRemoveRepository: (repositoryId: string) => void | Promise<void>;
  onCopyRepositoryPath: (repositoryId: string) => void | Promise<void>;
  onOpenInFinder: (repositoryId: string) => void | Promise<void>;
  onOpenSettings: () => void;
  onOpenMarketplace: () => void;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onCreateThread: (worktreeId: string) => string | Promise<string>;
  onCloseThread: (threadId: string) => void | Promise<void>;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onOpenLauncher: () => void;
  onCloseLauncher: () => void;
  onOpenFileTree: () => void;
  onCloseFileTree: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
  onOpenActivity: () => void;
  onGitCommitMessageChange: (value: string) => void;
  onRefreshGit: () => void | Promise<void>;
  onCommitGit: () => void | Promise<void>;
  onPullGit: () => void | Promise<void>;
  onPushGit: () => void | Promise<void>;
  onStageGitFile: (filePath: string) => void | Promise<void>;
  onUnstageGitFile: (filePath: string) => void | Promise<void>;
  onDiscardGitFile: (filePath: string) => void | Promise<void>;
  onFileClick: (filePath: string) => void | Promise<void>;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  onLauncherQueryChange: (query: string) => void | Promise<void>;
  onLauncherSelect: (match: import("@pidesk/shared").SearchMatch) => void;
  onLauncherHover: (index: number) => void;
  onLauncherKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  onAutocompleteSelect: (
    suggestion: SlashSuggestion | MentionSuggestion,
  ) => void;
  onAutocompleteHover: (index: number) => void;
  onPromptKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onModelSelection: (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => void | Promise<void>;
  promptMode: PromptMode;
  onPromptModeChange: (mode: PromptMode) => void;
}

export function WorkspaceShell({
  platform: _platform,
  repositories,
  activeRepository,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  activeThreadTitle,
  draft,
  canSend,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  displayAgentStatus,
  runtimeModeLabel,
  providerSnapshots,
  currentModelValue,
  isSwitchingModel,
  isLauncherOpen,
  isFileTreeOpen,
  isPromptVisible,
  isPromptExecuting,
  launcherQuery,
  launcherResults,
  launcherSelectedIndex,
  launcherIsLoading,
  activeGitRepositoryStatus,
  shellGit,
  gitCommitMessage,
  threadMessages,
  threadLastError,
  liveFeed,
  contextWindows,
  selectedContextSurface,
  leftRailWidth,
  onLeftRailResize,
  onModelMenuOpenChange: _onModelMenuOpenChange,
  onAddRepository,
  onSelectRepository,
  onRenameRepository,
  onRemoveRepository,
  onCopyRepositoryPath,
  onOpenInFinder,
  onOpenSettings,
  onOpenMarketplace,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onOpenLauncher: _onOpenLauncher,
  onCloseLauncher,
  onOpenFileTree: _onOpenFileTree,
  onCloseFileTree,
  onOpenGit,
  onOpenTerminal,
  onOpenActivity: _onOpenActivity,
  onGitCommitMessageChange,
  onRefreshGit,
  onCommitGit,
  onPullGit,
  onPushGit,
  onStageGitFile,
  onUnstageGitFile,
  onDiscardGitFile,
  onFileClick,
  onFileContentChange,
  onFileSave,
  onLauncherQueryChange,
  onLauncherSelect,
  onLauncherHover,
  onLauncherKeyDown,
  onDraftChange,
  onSend,
  onCancelPrompt,
  onAutocompleteSelect,
  onAutocompleteHover,
  onPromptKeyDown,
  onModelSelection,
  promptMode,
  onPromptModeChange,
}: WorkspaceShellProps) {
  const [isLeftRailVisible, setIsLeftRailVisible] = React.useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = React.useState(true);

  React.useEffect(() => {
    let disposed = false;
    const interactions = uiInteractionStore.getState();

    void window.pidesk.window.getFullscreenState().then((isFullscreen) => {
      if (!disposed) {
        interactions.setMainWindowFullscreen(isFullscreen);
      }
    });

    const unsubscribe = window.pidesk.window.onFullscreenChanged(
      (isFullscreen) => {
        uiInteractionStore.getState().setMainWindowFullscreen(isFullscreen);
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const projectName =
    activeRepository?.customName ?? activeRepository?.name ?? "Pi";
  const activeWorktree =
    activeRepository?.worktrees.find(
      (worktree) => worktree.id === activeWorktreeId,
    ) ?? null;
  const activeWorktreeLabel = activeWorktree?.label ?? null;

  const launcherActions = React.useMemo<WorkspaceSearchAction[]>(
    () => [
      {
        id: "terminal",
        label: "Terminal",
        onSelect: () => {
          onCloseLauncher();
          onOpenTerminal();
        },
      },
      {
        id: "git",
        label: "Git",
        onSelect: () => {
          onCloseLauncher();
          onOpenGit();
        },
      },
    ],
    [onCloseLauncher, onOpenGit, onOpenTerminal],
  );

  const hasActiveThread = activeThreadId !== null;
  const leftRailTargetWidth = Math.max(leftRailWidth, SIDEBAR_WIDTH);
  const _hasTranscriptHistory =
    threadMessages.length > 0 || isPromptExecuting || threadLastError !== null;
  const selectedSurfaceKey =
    selectedContextSurface === null
      ? null
      : selectedContextSurface === "activity"
        ? "activity"
        : contextWindows.some((window) => window.id === selectedContextSurface)
          ? selectedContextSurface
          : null;
  const _activeSurfaceKind =
    selectedSurfaceKey === null
      ? null
      : selectedSurfaceKey === "activity"
        ? "activity"
        : (contextWindows.find((window) => window.id === selectedSurfaceKey)
            ?.kind ?? null);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden select-none">
      {/* Item 2: TitleBar removed — drag region is in LeftRail */}

      {/* Item 22: Main Layout — always-visible three-column layout */}
      <div className="relative flex min-h-0 flex-1 select-none">
        {!isLeftRailVisible ? (
          <div
            aria-hidden="true"
            data-no-drag="true"
            onMouseEnter={() => setIsLeftRailVisible(true)}
            className="absolute inset-y-0 left-0 z-30 w-2"
          />
        ) : null}

        {/* Item 3: Sidebar width 220, resize 160–320 */}
        <div
          className={cn(
            "min-h-0 shrink-0 overflow-hidden",
            "transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]",
            isLeftRailVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{ width: isLeftRailVisible ? leftRailTargetWidth : 0 }}
        >
          <div
            className={cn(
              "h-full transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]",
              isLeftRailVisible ? "opacity-100" : "opacity-0",
            )}
            style={{ width: leftRailTargetWidth }}
          >
            <LeftRail
              repositories={repositories}
              activeRepositoryId={activeRepositoryId}
              activeWorktreeId={activeWorktreeId}
              activeThreadId={activeThreadId}
              width={leftRailTargetWidth}
              onResize={onLeftRailResize}
              onSelectRepository={onSelectRepository}
              onRenameRepository={onRenameRepository}
              onRemoveRepository={onRemoveRepository}
              onCopyRepositoryPath={onCopyRepositoryPath}
              onOpenInFinder={onOpenInFinder}
              onSelectWorktree={onSelectWorktree}
              onSelectThread={onSelectThread}
              onCreateThread={onCreateThread}
              onCloseThread={onCloseThread}
              onRenameThread={onRenameThread}
              onAddRepository={onAddRepository}
              onOpenSettings={onOpenSettings}
              onToggleVisible={() => setIsLeftRailVisible(false)}
            />
          </div>
        </div>

        {/* Item 18: Main area bg #0d0d0d */}
        <main
          data-testid="chat-first-layout"
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden",
            "bg-[var(--shell-main-bg)]",
          )}
        >
          {/* Item 14: Workspace header */}
          <div
            data-drag-region="true"
            className="flex h-11 shrink-0 items-center justify-between px-4 select-none border-b border-white/[0.03]"
          >
            <div className="flex items-center gap-2 text-[12px] text-white/60" />
            <div className="flex items-center gap-1" data-no-drag="true">
              <button
                type="button"
                onClick={onOpenMarketplace}
                className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
              >
                <SquaresFour className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsRightPanelVisible(!isRightPanelVisible)}
                className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors duration-150 hover:bg-white/[0.04] hover:text-white/60"
              >
                <SidebarSimple className="size-4 -scale-x-100" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 overflow-hidden select-none">
            {/* Chat panel - takes remaining space */}
            <div
              className={cn(
                "relative flex min-h-0 flex-1 flex-col select-none",
                "border-r border-white/[0.06]",
              )}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden">
                {hasActiveThread ? (
                  <ChatThreadPanel
                    threadTitle={activeThreadTitle ?? "Untitled thread"}
                    messages={threadMessages}
                    isStreaming={isPromptExecuting}
                    lastError={threadLastError}
                    className="h-full"
                  />
                ) : null}
              </div>

              <div className="shrink-0">
                <PromptDock
                  draft={draft}
                  onDraftChange={onDraftChange}
                  onSend={onSend}
                  onCancelPrompt={onCancelPrompt}
                  activeThreadId={activeThreadId}
                  canSend={canSend}
                  isVisible={isPromptVisible}
                  isPromptExecuting={isPromptExecuting}
                  autocompleteSuggestions={autocompleteSuggestions}
                  autocompleteSelectedIndex={autocompleteSelectedIndex}
                  onAutocompleteSelect={onAutocompleteSelect}
                  onAutocompleteHover={onAutocompleteHover}
                  onPromptKeyDown={onPromptKeyDown}
                  displayAgentStatus={displayAgentStatus}
                  runtimeModeLabel={runtimeModeLabel}
                  providerSnapshots={providerSnapshots}
                  currentModelValue={currentModelValue}
                  isSwitchingModel={isSwitchingModel}
                  promptMode={promptMode}
                  onPromptModeChange={onPromptModeChange}
                  onModelMenuOpenChange={_onModelMenuOpenChange}
                  onModelSelection={onModelSelection}
                />
              </div>
            </div>

            {/* Right panel - 3 column design with animation */}
            <div
              className={cn(
                "min-h-0 shrink-0 overflow-hidden border-l border-white/[0.06] bg-[#0a0a0a]",
                "transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]",
                isRightPanelVisible
                  ? "w-[300px] xl:w-[400px] opacity-100"
                  : "w-0 opacity-0",
              )}
            >
              <div
                className={cn(
                  "h-full min-w-[300px] xl:min-w-[400px]",
                  "transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]",
                  isRightPanelVisible ? "opacity-100" : "opacity-0",
                )}
              >
                {selectedSurfaceKey === "activity" ? (
                  <WorkspaceActivityPanel
                    threadTitle={activeThreadTitle}
                    worktreeLabel={activeWorktreeLabel}
                    displayAgentStatus={displayAgentStatus}
                    liveFeed={liveFeed}
                    className="h-full"
                  />
                ) : selectedSurfaceKey !== null ? (
                  <WorkspaceSurfacePanel
                    activeWorktreeId={activeWorktreeId}
                    selectedSurfaceKey={selectedSurfaceKey ?? ""}
                    windows={contextWindows}
                    onFileContentChange={onFileContentChange}
                    onFileSave={onFileSave}
                    activityContent={
                      <GitPanel
                        projectName={projectName}
                        repositoryPath={
                          activeWorktree?.path ??
                          activeRepository?.rootPath ??
                          null
                        }
                        worktree={activeWorktree}
                        repositoryStatus={activeGitRepositoryStatus}
                        shellGit={shellGit}
                        commitMessage={gitCommitMessage}
                        onCommitMessageChange={onGitCommitMessageChange}
                        onRefresh={onRefreshGit}
                        onCommit={onCommitGit}
                        onPull={onPullGit}
                        onPush={onPushGit}
                        onStageFile={onStageGitFile}
                        onUnstageFile={onUnstageGitFile}
                        onDiscardFile={onDiscardGitFile}
                      />
                    }
                  />
                ) : (
                  <GitPanel
                    projectName={projectName}
                    repositoryPath={
                      activeWorktree?.path ?? activeRepository?.rootPath ?? null
                    }
                    worktree={activeWorktree}
                    repositoryStatus={activeGitRepositoryStatus}
                    shellGit={shellGit}
                    commitMessage={gitCommitMessage}
                    onCommitMessageChange={onGitCommitMessageChange}
                    onRefresh={onRefreshGit}
                    onCommit={onCommitGit}
                    onPull={onPullGit}
                    onPush={onPushGit}
                    onStageFile={onStageGitFile}
                    onUnstageFile={onUnstageGitFile}
                    onDiscardFile={onDiscardGitFile}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Overlays */}
      {isLauncherOpen ? (
        <LauncherOverlay
          ariaLabel="Launcher overlay"
          projectName={projectName}
          activeWorktreeLabel={activeWorktreeLabel}
          query={launcherQuery}
          isLoading={launcherIsLoading}
          results={launcherResults}
          selectedIndex={launcherSelectedIndex}
          actions={launcherActions}
          onClose={onCloseLauncher}
          onQueryChange={(query) => void onLauncherQueryChange(query)}
          onSelect={onLauncherSelect}
          onHover={onLauncherHover}
          onKeyDown={onLauncherKeyDown}
        />
      ) : null}

      {isFileTreeOpen ? (
        <FileTreeOverlay
          ariaLabel="File tree overlay"
          projectName={projectName}
          activeWorktree={activeWorktree}
          onClose={onCloseFileTree}
          onFileClick={onFileClick}
        />
      ) : null}
    </div>
  );
}
