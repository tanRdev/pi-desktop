import type {
  CanvasWindow,
  MentionSuggestion,
  ProviderSnapshot,
  RepositoryDisplayMetadata,
  RepositorySnapshot,
  SlashSuggestion,
  ThreadSnapshot,
} from "@pidesk/shared";
import * as React from "react";
import { useStore } from "zustand";
import { cn } from "@/lib/utils";
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { CanvasContainer, CanvasGrid, WindowContentRouter } from "../canvas";
import type { GraphLink, GraphNode } from "../canvas/graph-window-content";
import type { SearchWindowAction } from "../canvas/search-window-content";
import { LeftRail, type RailView } from "./left-rail";
import { LeftSidebar } from "./left-sidebar";
import { PromptDock } from "./prompt-dock";
import { StatusBar } from "./status-bar";
import { TitleBar } from "./title-bar";
import { FileTreeOverlay, LauncherOverlay } from "./workspace-overlays";

export interface WorkspaceShellProps {
  repositories: RepositorySnapshot[];
  activeRepository: RepositorySnapshot | null;
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  draft: string;
  canSend: boolean;
  leftSidebarWidth: number;
  snapGridSize: number;
  windowCount: number;
  threadLookup: Map<string, ThreadSnapshot>;
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
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
  onOpenBlankStateChat: (
    canvasBounds: DOMRect | null,
  ) => boolean | Promise<boolean>;
  onOpenNote: () => void;
  onOpenGit: () => void;
  onOpenTerminal: () => void;
  onOpenGraph: () => void;
  onFileClick: (filePath: string) => void | Promise<void>;
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void | Promise<void>;
  onNoteContentChange: (windowId: string, content: string) => void;
  onNoteSave: (windowId: string, storagePath?: string) => void | Promise<void>;
  onSearchQueryChange: (
    windowId: string,
    query: string,
  ) => void | Promise<void>;
  onSearchSelect: (match: import("@pidesk/shared").SearchMatch) => void;
  onSearchHover: (windowId: string, index: number) => void;
  onSearchKeyDown: (
    windowId: string,
  ) => React.KeyboardEventHandler<HTMLInputElement>;
  onLauncherQueryChange: (query: string) => void | Promise<void>;
  onLauncherSelect: (match: import("@pidesk/shared").SearchMatch) => void;
  onLauncherHover: (index: number) => void;
  onLauncherKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onWindowFocus: (window: CanvasWindow) => void | Promise<void>;
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

function CanvasEmptyState({
  activeWorktreeId,
  activeThreadId,
  onOpenBlankStateChat,
}: {
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  onOpenBlankStateChat: (
    canvasBounds: DOMRect | null,
  ) => boolean | Promise<boolean>;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const attemptedLaunchKeyRef = React.useRef<string | null>(null);
  const [isLaunching, setIsLaunching] = React.useState(false);

  React.useEffect(() => {
    const launchKey = `${activeWorktreeId ?? "no-worktree"}:${activeThreadId ?? "blank"}`;
    if (attemptedLaunchKeyRef.current === launchKey) {
      return;
    }

    attemptedLaunchKeyRef.current = launchKey;
    let cancelled = false;
    const canvasBounds = containerRef.current?.getBoundingClientRect() ?? null;

    setIsLaunching(true);
    void Promise.resolve(onOpenBlankStateChat(canvasBounds)).finally(() => {
      if (!cancelled) {
        setIsLaunching(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeThreadId, activeWorktreeId, onOpenBlankStateChat]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 py-10"
    >
      <div
        className={cn(
          "w-full max-w-xl border border-[#474747]/30 bg-[#0e0e0e] px-6 py-5",
          "motion-safe:animate-[window-enter_0.15s_var(--ease-out)_forwards]",
        )}
      >
        <div className="space-y-4 text-sm leading-6 text-[#919191] font-mono">
          <div className="stagger-item" style={{ animationDelay: "0ms" }}>
            <p className="text-base font-bold text-white uppercase tracking-widest">
              # Canvas
            </p>
            <p className="mt-1">
              Arrange chats, terminals, notes, and files here as you work.
            </p>
          </div>
          <div className="stagger-item" style={{ animationDelay: "40ms" }}>
            <p className="font-bold text-white uppercase tracking-widest">
              ## Quick start
            </p>
            <p className="mt-1">
              - Blank canvases now boot into chat first so the workspace opens
              in conversation mode.
            </p>
            <p>
              - Use the title bar for launcher, files, notes, and git while the
              rail handles project navigation.
            </p>
            <p>
              -{" "}
              {activeThreadId
                ? "The active thread is being centered on the canvas now."
                : isLaunching
                  ? "Preparing a thread so chat can open in the center of the canvas."
                  : "Waiting for a thread so chat can claim the center of the canvas."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  repositories,
  activeRepository,
  activeRepositoryId,
  activeWorktreeId,
  activeThreadId,
  activeThreadTitle,
  draft,
  canSend,
  leftSidebarWidth,
  snapGridSize,
  windowCount,
  threadLookup,
  graphNodes,
  graphLinks,
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
  onOpenBlankStateChat,
  onOpenNote,
  onOpenGit,
  onOpenTerminal,
  onOpenGraph,
  onFileClick,
  onFileContentChange,
  onFileSave,
  onNoteContentChange,
  onNoteSave,
  onSearchQueryChange,
  onSearchSelect,
  onSearchHover,
  onSearchKeyDown,
  onLauncherQueryChange,
  onLauncherSelect,
  onLauncherHover,
  onLauncherKeyDown,
  onWindowFocus,
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

  const handleCanvasWindowFocus = React.useCallback(
    (window: CanvasWindow) => {
      void onWindowFocus(window);
    },
    [onWindowFocus],
  );

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

  const launcherActions = React.useMemo<SearchWindowAction[]>(
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
      {
        id: "graph",
        label: "Graph",
        onSelect: () => {
          onCloseLauncher();
          onOpenGraph();
        },
      },
    ],
    [onCloseLauncher, onOpenGit, onOpenGraph, onOpenNote, onOpenTerminal],
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

  const renderWindowContent = React.useCallback(
    (win: CanvasWindow) => (
      <WindowContentRouter
        win={win}
        activeWorktreeId={activeWorktreeId}
        activeThreadId={activeThreadId}
        threadLookup={threadLookup}
        graphNodes={graphNodes}
        graphLinks={graphLinks}
        onFileContentChange={onFileContentChange}
        onFileSave={onFileSave}
        onNoteContentChange={onNoteContentChange}
        onNoteSave={onNoteSave}
        onSearchQueryChange={onSearchQueryChange}
        onSearchSelect={onSearchSelect}
        onSearchHover={onSearchHover}
        onSearchKeyDown={onSearchKeyDown}
        onOpenTerminal={onOpenTerminal}
        onOpenGit={onOpenGit}
        onOpenNote={onOpenNote}
        onOpenGraph={onOpenGraph}
      />
    ),
    [
      activeThreadId,
      activeWorktreeId,
      graphLinks,
      graphNodes,
      onFileContentChange,
      onFileSave,
      onNoteContentChange,
      onNoteSave,
      onOpenGit,
      onOpenGraph,
      onOpenNote,
      onOpenTerminal,
      onSearchHover,
      onSearchKeyDown,
      onSearchQueryChange,
      onSearchSelect,
      threadLookup,
    ],
  );

  return (
    <>
      <TitleBar
        projectName={projectName}
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
          className={cn(
            "relative z-10 flex min-w-0 flex-1 flex-col",
            (isLeftSidebarCollapsed || leftRailMode === "projects") && "ml-16",
          )}
        >
          <CanvasGrid
            snapGridSize={snapGridSize}
            className="pointer-events-none absolute inset-0 z-0 opacity-70"
          />
          <div className="relative min-h-0 flex-1">
            <CanvasContainer
              className="h-full"
              onWindowFocus={handleCanvasWindowFocus}
              renderWindowContent={renderWindowContent}
            />
            {windowCount === 0 ? (
              <CanvasEmptyState
                activeWorktreeId={activeWorktreeId}
                activeThreadId={activeThreadId}
                onOpenBlankStateChat={onOpenBlankStateChat}
              />
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20">
              <div className="pointer-events-auto">
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
          </div>
        </main>
      </div>

      {isLauncherOpen ? (
        <LauncherOverlay
          // aria-label="Launcher overlay"
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
          // aria-label="File tree overlay"
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
