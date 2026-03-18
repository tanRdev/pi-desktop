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
  onAddRepository,
  onSelectRepository,
  onUpdateRepositoryPreferences,
  onOpenSettings,
  onSelectWorktree,
  onSelectThread,
  onCreateThread,
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
  const handleCanvasWindowFocus = React.useCallback(
    (window: CanvasWindow) => {
      void onWindowFocus(window);
    },
    [onWindowFocus],
  );

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
        onOpenLauncher={onOpenLauncher}
        onOpenNote={onOpenNote}
        onOpenGit={onOpenGit}
        onOpenTerminal={onOpenTerminal}
      />

      <div className="relative flex min-h-0 flex-1">
        <CanvasGrid
          snapGridSize={snapGridSize}
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.25]"
        />

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
          onCreateWorktree={onCreateWorktree}
          width={leftSidebarWidth}
          onResize={onLeftSidebarResize}
          className="z-10"
        />

        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <CanvasContainer
              className="h-full"
              onWindowFocus={handleCanvasWindowFocus}
              renderWindowContent={renderWindowContent}
            />
            {windowCount === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
                <div className="max-w-md rounded-2xl border border-dashed border-border bg-surface-1 px-6 py-5 text-center shadow-sm">
                  <h2 className="text-base font-semibold text-foreground">
                    Open threads in their own windows
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {activeThreadId
                      ? "Click a thread in the left sidebar, or send a message, to open or refocus its chat window here."
                      : "Select a thread in the left sidebar to open its dedicated chat window."}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

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
            onModelSelection={onModelSelection}
          />
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
