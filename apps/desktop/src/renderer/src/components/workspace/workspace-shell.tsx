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
import { uiInteractionStore } from "../../stores/ui-interaction-store";
import { CanvasContainer, CanvasGrid, WindowContentRouter } from "../canvas";
import type { GraphLink, GraphNode } from "../canvas/graph-window-content";
import { FileTree } from "../ui/file-tree";
import { ScrollArea } from "../ui/scroll-area";
import { LeftRail } from "./left-rail";
import { LeftSidebar } from "./left-sidebar";
import { PromptDock } from "./prompt-dock";
import { TitleBar } from "./title-bar";

export interface WorkspaceShellProps {
  repositories: RepositorySnapshot[];
  activeRepository: RepositorySnapshot | null;
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
  activeWorktreePath: string | null;
  activeThreadId: string | null;
  activeThreadTitle: string | null;
  draft: string;
  canSend: boolean;
  sidebarView: "files" | "git" | "notes" | null;
  setSidebarView: (view: "files" | "git" | "notes" | null) => void;
  hasOpenNotes: boolean;
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
  onWindowFocus: (window: CanvasWindow) => void | Promise<void>;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
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
  activeThreadId,
  onOpenNote,
}: {
  activeThreadId: string | null;
  onOpenNote: () => void;
}) {
  const hasAutoOpened = React.useRef(false);

  React.useEffect(() => {
    if (!hasAutoOpened.current) {
      hasAutoOpened.current = true;
      onOpenNote();
    }
  }, [onOpenNote]);

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 py-10">
      <div className="w-full max-w-xl rounded-lg border border-border/40 bg-surface-1/80 px-6 py-5 shadow-sm">
        <div className="space-y-4 text-sm leading-6 text-muted-foreground">
          <div>
            <p className="text-base font-semibold text-foreground"># Canvas</p>
            <p className="mt-1">
              Arrange chats, terminals, notes, and files here as you work.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">## Quick start</p>
            <p className="mt-1">
              - Pick a thread from the left sidebar to bring chat onto the
              canvas.
            </p>
            <p>- Use the title bar to open a terminal, notes, git, or files.</p>
            <p>
              -{" "}
              {activeThreadId
                ? "Send a message to open or refocus the active chat window here."
                : "Select a thread first, then send a message when you're ready."}
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
  activeWorktreePath,
  activeThreadId,
  activeThreadTitle,
  draft,
  canSend,
  sidebarView,
  setSidebarView,
  hasOpenNotes,
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
  onWindowFocus,
  onDraftChange,
  onSend,
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

  const handleToggleLeftSidebar = React.useCallback(() => {
    setIsLeftSidebarCollapsed((prev) => !prev);
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
        activeRepository={activeRepository}
        activeWorktreeLabel={
          activeRepository?.worktrees.find(
            (worktree) => worktree.id === activeWorktreeId,
          )?.label ?? null
        }
        sidebarView={sidebarView}
        setSidebarView={setSidebarView}
        hasOpenNotes={hasOpenNotes}
        isMainWindowFullscreen={isMainWindowFullscreen}
        isLeftSidebarCollapsed={isLeftSidebarCollapsed}
        onToggleLeftSidebar={handleToggleLeftSidebar}
        onOpenLauncher={onOpenLauncher}
        onOpenNote={onOpenNote}
        onOpenGit={onOpenGit}
        onOpenTerminal={onOpenTerminal}
      />

      <div className="relative flex min-h-0 flex-1">
        <LeftRail
          repositories={repositories}
          activeRepositoryId={activeRepositoryId}
          onSelectRepository={onSelectRepository}
          onUpdateRepositoryPreferences={onUpdateRepositoryPreferences}
          onAddRepository={onAddRepository}
          onOpenSettings={onOpenSettings}
        />

        <LeftSidebar
          repository={activeRepository}
          activeWorktreeId={activeWorktreeId}
          activeThreadId={activeThreadId}
          onUpdateRepositoryPreferences={onUpdateRepositoryPreferences}
          onSelectWorktree={onSelectWorktree}
          onSelectThread={onSelectThread}
          onCreateThread={onCreateThread}
          onCloseThread={onCloseThread}
          onRenameThread={onRenameThread}
          onCreateWorktree={onCreateWorktree}
          width={leftSidebarWidth}
          onResize={onLeftSidebarResize}
          isCollapsed={isLeftSidebarCollapsed}
          className="z-10"
        />

        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          <CanvasGrid
            snapGridSize={snapGridSize}
            className="pointer-events-none absolute inset-0 z-0 opacity-50"
          />
          <div className="relative min-h-0 flex-1">
            <CanvasContainer
              className="h-full"
              onWindowFocus={handleCanvasWindowFocus}
              renderWindowContent={renderWindowContent}
            />
            {windowCount === 0 ? (
              <CanvasEmptyState
                activeThreadId={activeThreadId}
                onOpenNote={onOpenNote}
              />
            ) : null}
          </div>

          <div className="pointer-events-none relative z-20 shrink-0">
            <div className="pointer-events-auto">
              <PromptDock
                draft={draft}
                onDraftChange={onDraftChange}
                onSend={onSend}
                activeThreadId={activeThreadId}
                activeThreadTitle={activeThreadTitle}
                canSend={canSend}
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
        </main>

        {sidebarView === "files" ? (
          <aside className="relative z-10 flex h-full w-64 shrink-0 flex-col border-l border-border bg-surface-1">
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-2">
                <FileTree
                  rootPath={activeWorktreePath}
                  onFileClick={onFileClick}
                />
              </div>
            </ScrollArea>
          </aside>
        ) : null}
      </div>
    </>
  );
}
