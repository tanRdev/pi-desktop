import type {
  MentionSuggestion,
  ProviderSnapshot,
  RepositorySnapshot,
  SlashSuggestion,
} from "@pidesk/shared";
import type { AgentLiveFeed } from "@pidesk/shell-model";
import * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { ChatThreadPanel } from "./chat-thread-panel";
import { LeftRail } from "./left-rail";
import { PromptDock } from "./prompt-dock";
import { TitleBar } from "./title-bar";
import { WorkspaceActivityPanel } from "./workspace-activity-panel";
import { FileTreeOverlay, LauncherOverlay } from "./workspace-overlays";
import type { WorkspaceSearchAction } from "./workspace-search-content";
import { WorkspaceSurfacePanel } from "./workspace-surface-panel";

type ContextSurfaceKey = "activity" | string;
type ContextWindow = Extract<
  import("@pidesk/shared").WorkspaceWindow,
  { kind: "file" | "terminal" | "git" }
>;

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
  onOpenSettings: () => void;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  onCloseThread: (threadId: string) => void | Promise<void>;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onOpenLauncher: () => void;
  onCloseLauncher: () => void;
  onOpenFileTree: () => void;
  onCloseFileTree: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
  onOpenActivity: () => void;
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
}

function WorkspaceEmptyState({
  activeThreadTitle,
  onCreateThread,
  activeWorktreeId,
}: {
  activeThreadTitle: string | null;
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  activeWorktreeId: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="max-w-xl space-y-6">
        <h2 className="text-2xl font-medium text-[var(--color-text-primary)]">
          {activeThreadTitle?.trim() || "New thread"}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Start typing below to begin the conversation.
        </p>
        {activeWorktreeId ? (
          <button
            type="button"
            onClick={() => void onCreateThread(activeWorktreeId)}
            className="rounded-lg bg-[var(--color-text-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-text-secondary)]"
          >
            Create thread
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceShell({
  platform,
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
  threadMessages,
  threadLastError,
  liveFeed,
  contextWindows,
  selectedContextSurface,
  leftRailWidth,
  onLeftRailResize,
  onModelMenuOpenChange,
  onAddRepository,
  onSelectRepository,
  onOpenSettings,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onOpenLauncher,
  onCloseLauncher,
  onOpenFileTree,
  onCloseFileTree,
  onOpenGit,
  onOpenTerminal,
  onOpenActivity,
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
}: WorkspaceShellProps) {
  const isMainWindowFullscreen = useStore(
    uiInteractionStore,
    (storeState) => storeState.isMainWindowFullscreen,
  );

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
    activeRepository?.customName ?? activeRepository?.name ?? "PiDesk";
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
  const selectedSurfaceKey =
    selectedContextSurface === null
      ? null
      : selectedContextSurface === "activity"
        ? "activity"
        : contextWindows.some((window) => window.id === selectedContextSurface)
          ? selectedContextSurface
          : null;
  const activeSurfaceKind =
    selectedSurfaceKey === null
      ? null
      : selectedSurfaceKey === "activity"
        ? "activity"
        : (contextWindows.find((window) => window.id === selectedSurfaceKey)
            ?.kind ?? null);

  return (
    <>
      <TitleBar
        projectName={projectName}
        platform={platform}
        activeWorktreeLabel={activeWorktreeLabel}
        worktrees={activeRepository?.worktrees ?? []}
        activeWorktreeId={activeWorktreeId}
        isMainWindowFullscreen={isMainWindowFullscreen}
        onSelectWorktree={onSelectWorktree}
        onOpenLauncher={onOpenLauncher}
        onOpenFileTree={onOpenFileTree}
        onOpenTerminal={onOpenTerminal}
        onOpenGit={onOpenGit}
        onOpenActivity={onOpenActivity}
        onOpenSettings={onOpenSettings}
        activeSurfaceKind={activeSurfaceKind}
      />

      <div className="relative flex min-h-0 flex-1">
        <LeftRail
          repositories={repositories}
          activeRepositoryId={activeRepositoryId}
          activeWorktreeId={activeWorktreeId}
          activeThreadId={activeThreadId}
          width={leftRailWidth}
          onResize={onLeftRailResize}
          onSelectRepository={onSelectRepository}
          onSelectWorktree={onSelectWorktree}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onCloseThread={onCloseThread}
          onRenameThread={onRenameThread}
          onAddRepository={onAddRepository}
        />

        <main
          data-testid="chat-first-layout"
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0b0b0b]",
          )}
        >
          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              {selectedSurfaceKey === null ? (
                hasActiveThread ? (
                  <ChatThreadPanel
                    threadTitle={activeThreadTitle ?? "Untitled thread"}
                    messages={threadMessages}
                    isStreaming={isPromptExecuting}
                    lastError={threadLastError}
                    className="h-full"
                  />
                ) : (
                  <WorkspaceEmptyState
                    activeThreadTitle={activeThreadTitle}
                    activeWorktreeId={activeWorktreeId}
                    onCreateThread={onCreateThread}
                  />
                )
              ) : (
                <WorkspaceSurfacePanel
                  activeWorktreeId={activeWorktreeId}
                  selectedSurfaceKey={selectedSurfaceKey}
                  windows={contextWindows}
                  onFileContentChange={onFileContentChange}
                  onFileSave={onFileSave}
                  activityContent={
                    <WorkspaceActivityPanel
                      threadTitle={activeThreadTitle}
                      worktreeLabel={activeWorktreeLabel}
                      displayAgentStatus={displayAgentStatus}
                      liveFeed={liveFeed}
                      className="h-full"
                    />
                  }
                />
              )}
            </div>

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
              onModelMenuOpenChange={onModelMenuOpenChange}
              onModelSelection={onModelSelection}
            />
          </section>
        </main>
      </div>

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
    </>
  );
}
