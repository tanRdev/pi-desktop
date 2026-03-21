import type {
  MentionSuggestion,
  ProviderSnapshot,
  RepositoryDisplayMetadata,
  RepositorySnapshot,
  SlashSuggestion,
  ThreadSnapshot,
} from "@pidesk/shared";
import type { AgentLiveFeed } from "@pidesk/shell-model";
import * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { ChatThreadPanel } from "./chat-thread-panel";
import { LeftRail, type RailView } from "./left-rail";
import { LeftSidebar } from "./left-sidebar";
import { PromptDock } from "./prompt-dock";
import { StatusBar } from "./status-bar";
import { TitleBar } from "./title-bar";
import { WorkspaceActivityPanel } from "./workspace-activity-panel";
import { FileTreeOverlay, LauncherOverlay } from "./workspace-overlays";
import type { WorkspaceSearchAction } from "./workspace-search-content";
import { WorkspaceSurfacePanel } from "./workspace-surface-panel";

type ContextSurfaceKey = "activity" | string;

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
  leftSidebarWidth: number;
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
  contextWindows: Array<
    Extract<
      import("@pidesk/shared").CanvasWindow,
      { kind: "file" | "note" | "terminal" | "git" }
    >
  >;
  selectedContextSurface: ContextSurfaceKey;
  onSelectContextSurface: (surfaceKey: ContextSurfaceKey) => void;
  onCloseContextSurface: (surfaceKey: string) => void;
  onModelMenuOpenChange: (open: boolean) => void | Promise<void>;
  onAddRepository: () => void | Promise<void>;
  onSelectRepository: (repositoryId: string) => void | Promise<void>;
  onUpdateRepositoryPreferences: (
    repositoryId: string,
    updates: Partial<RepositoryDisplayMetadata>,
  ) => void | Promise<void>;
  onOpenSettings: () => void;
  onSelectWorktree: (worktreeId: string) => void | Promise<void>;
  onSelectThread: (threadId: string) => void | Promise<void>;
  onCreateThread: (worktreeId: string) => void | Promise<void>;
  onCloseThread: (threadId: string) => void | Promise<void>;
  onRenameThread: (threadId: string, title: string) => void | Promise<void>;
  onCreateWorktree: () => void;
  onLeftSidebarResize: (width: number) => void;
  onOpenLauncher: () => void;
  onCloseLauncher: () => void;
  onOpenFileTree: () => void;
  onCloseFileTree: () => void;
  onOpenNote: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
  onFileClick: (filePath: string) => void | Promise<void>;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  onNoteContentChange: (windowId: string, content: string) => void;
  onNoteSave: (windowId: string, storagePath?: string) => void | Promise<void>;
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
      <div className="max-w-2xl space-y-4 border border-[#474747]/18 bg-[#101010] px-8 py-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#6f6f6f]">
          Chat-first workspace
        </p>
        <h2 className="text-2xl text-white">
          {activeThreadTitle?.trim() || "Start the next conversation"}
        </h2>
        <p className="text-sm leading-7 text-[#8f8f8f]">
          PiDesk now centers the chat, planning, reasoning, and execution loop.
          Use the context panel for files, notes, terminal, and git without the
          old floating canvas.
        </p>
        {activeWorktreeId ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void onCreateThread(activeWorktreeId)}
              className="border border-[#474747]/20 bg-white px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#d9d9d9]"
            >
              New thread
            </button>
          </div>
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
  leftSidebarWidth,
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
  onSelectContextSurface,
  onCloseContextSurface,
  onModelMenuOpenChange,
  onAddRepository,
  onSelectRepository,
  onUpdateRepositoryPreferences,
  onOpenSettings,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
  onCloseThread,
  onRenameThread,
  onCreateWorktree,
  onLeftSidebarResize,
  onOpenLauncher,
  onCloseLauncher,
  onOpenFileTree,
  onCloseFileTree,
  onOpenNote,
  onOpenGit,
  onOpenTerminal,
  onFileClick,
  onFileContentChange,
  onFileSave,
  onNoteContentChange,
  onNoteSave,
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

  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] =
    React.useState(false);
  const [leftRailMode, setLeftRailMode] = React.useState<
    "projects" | "workspace"
  >("projects");
  const [activeRailView, setActiveRailView] = React.useState<RailView>(null);

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
      {
        id: "note",
        label: "Note",
        onSelect: () => {
          onCloseLauncher();
          onOpenNote();
        },
      },
    ],
    [onCloseLauncher, onOpenGit, onOpenNote, onOpenTerminal],
  );

  const handleToggleLeftSidebar = React.useCallback(() => {
    setIsLeftSidebarCollapsed((prev) => !prev);
  }, []);

  const handleShowProjectSelector = React.useCallback(() => {
    setLeftRailMode("projects");
    setActiveRailView(null);
    setIsLeftSidebarCollapsed(true);
  }, []);

  const handleEnterWorkspace = React.useCallback(
    (view: Exclude<RailView, null>) => {
      setLeftRailMode("workspace");
      setActiveRailView(view);
      setIsLeftSidebarCollapsed(false);
    },
    [],
  );

  const handleSelectRailView = React.useCallback((view: RailView) => {
    setActiveRailView(view);
    if (view !== null) {
      setLeftRailMode("workspace");
      setIsLeftSidebarCollapsed(false);
    }
  }, []);

  const hasActiveThread = activeThreadId !== null;
  const selectedSurfaceKey =
    selectedContextSurface === "activity"
      ? "activity"
      : contextWindows.some((window) => window.id === selectedContextSurface)
        ? selectedContextSurface
        : "activity";

  return (
    <>
      <TitleBar
        projectName={projectName}
        platform={platform}
        activeWorktreeLabel={activeWorktreeLabel}
        worktrees={activeRepository?.worktrees ?? []}
        activeWorktreeId={activeWorktreeId}
        isMainWindowFullscreen={isMainWindowFullscreen}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        onOpenLauncher={onOpenLauncher}
        onOpenFileTree={onOpenFileTree}
        onOpenGit={onOpenGit}
        onOpenNote={onOpenNote}
        onSelectWorktree={onSelectWorktree}
      />

      <div className="relative flex min-h-0 flex-1">
        <LeftRail
          repositories={repositories}
          mode={leftRailMode}
          activeRepositoryId={activeRepositoryId}
          activeView={activeRailView}
          onSelectRepository={onSelectRepository}
          onUpdateRepositoryPreferences={onUpdateRepositoryPreferences}
          onAddRepository={onAddRepository}
          onOpenSettings={onOpenSettings}
          onShowProjects={handleShowProjectSelector}
          onEnterWorkspace={handleEnterWorkspace}
          onSelectView={handleSelectRailView}
        />

        <LeftSidebar
          repository={activeRepository}
          activeWorktreeId={activeWorktreeId}
          activeThreadId={activeThreadId}
          activeView={activeRailView}
          onUpdateRepositoryPreferences={onUpdateRepositoryPreferences}
          onSelectWorktree={onSelectWorktree}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onCloseThread={onCloseThread}
          onRenameThread={onRenameThread}
          onCreateWorktree={onCreateWorktree}
          width={leftSidebarWidth}
          onResize={onLeftSidebarResize}
          isCollapsed={isLeftSidebarCollapsed || leftRailMode === "projects"}
          className="z-10"
        />

        <main
          data-testid="chat-first-layout"
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col bg-[#0b0b0b]",
            (isLeftSidebarCollapsed || leftRailMode === "projects") && "ml-16",
          )}
        >
          <div className="min-h-0 flex flex-1">
            <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                {hasActiveThread ? (
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
                )}
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-8 pt-16 bg-[linear-gradient(180deg,rgba(11,11,11,0)_0%,rgba(11,11,11,0.7)_35%,rgba(8,8,8,0.98)_100%)]">
                <div className="pointer-events-auto mx-auto w-full max-w-[52rem]">
                  <PromptDock
                    draft={draft}
                    onDraftChange={onDraftChange}
                    onSend={onSend}
                    onCancelPrompt={onCancelPrompt}
                    activeThreadId={activeThreadId}
                    activeThreadTitle={activeThreadTitle}
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
                </div>
              </div>
            </section>

            <div data-testid="workspace-context-panel" className="contents">
              <WorkspaceSurfacePanel
                activeWorktreeId={activeWorktreeId}
                selectedSurfaceKey={selectedSurfaceKey}
                windows={contextWindows}
                onSelectActivity={() => onSelectContextSurface("activity")}
                onSelectWindow={onSelectContextSurface}
                onCloseWindow={onCloseContextSurface}
                onOpenFileTree={onOpenFileTree}
                onOpenNote={onOpenNote}
                onOpenTerminal={onOpenTerminal}
                onOpenGit={onOpenGit}
                onFileContentChange={onFileContentChange}
                onFileSave={onFileSave}
                onNoteContentChange={onNoteContentChange}
                onNoteSave={onNoteSave}
                activityContent={
                  <WorkspaceActivityPanel
                    threadTitle={activeThreadTitle}
                    worktreeLabel={activeWorktreeLabel}
                    runtimeModeLabel={runtimeModeLabel}
                    displayAgentStatus={displayAgentStatus}
                    liveFeed={liveFeed}
                    className="h-full"
                  />
                }
              />
            </div>
          </div>
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

      <StatusBar activeWorktreeLabel={activeWorktreeLabel} />
    </>
  );
}
