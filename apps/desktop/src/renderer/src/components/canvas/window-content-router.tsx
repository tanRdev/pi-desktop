import type { CanvasWindow, SearchMatch, ThreadSnapshot } from "@pidesk/shared";
import type * as React from "react";
import { useStore } from "zustand";
import { workspaceSessionStore } from "../../hooks/use-window-store";
import {
  selectFileWindowStateByWorktree,
  selectNoteWindowStateByWorktree,
  selectSearchUiStateByWorktree,
  selectThreadConversationByWorktree,
} from "../../stores/workspace-session-selectors";
import type { ThreadConversationState } from "../../stores/workspace-session-store";
import { ChatWindowContent } from "./chat-window-content";
import { FileWindowContent } from "./file-window-content";
import {
  type GraphLink,
  type GraphNode,
  GraphWindowContent,
} from "./graph-window-content";
import { NoteWindowContent } from "./note-window-content";
import { SearchWindowContent } from "./search-window-content";
import { TerminalWindowContent } from "./terminal-window-content";

const EMPTY_THREAD_CONVERSATION: ThreadConversationState = {
  messages: [],
  status: "idle",
  lastError: null,
};

export interface WindowContentRouterProps {
  win: CanvasWindow;
  activeWorktreeId: string | null;
  activeThreadId: string | null;
  threadLookup: Map<string, ThreadSnapshot>;
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
  onFileContentChange: (windowId: string, content: string) => void;
  onFileSave: (windowId: string, filePath: string) => void;
  onNoteContentChange: (windowId: string, content: string) => void;
  onNoteSave: (windowId: string, storagePath?: string) => void;
  onSearchQueryChange: (
    windowId: string,
    query: string,
  ) => Promise<void> | void;
  onSearchSelect: (match: SearchMatch) => void;
  onSearchHover: (windowId: string, index: number) => void;
  onSearchKeyDown: (
    windowId: string,
  ) => React.KeyboardEventHandler<HTMLInputElement>;
  onOpenTerminal: () => void;
  onOpenGit: () => void;
  onOpenNote: () => void;
  onOpenGraph: () => void;
}

function getThreadWindowTitle(
  thread: ThreadSnapshot | null | undefined,
): string {
  const title = thread?.title.trim();
  return title && title.length > 0 ? title : "Untitled thread";
}

export function WindowContentRouter({
  win,
  activeWorktreeId,
  activeThreadId,
  threadLookup,
  graphNodes,
  graphLinks,
  onFileContentChange,
  onFileSave,
  onNoteContentChange,
  onNoteSave,
  onSearchQueryChange,
  onSearchSelect,
  onSearchHover,
  onSearchKeyDown,
  onOpenTerminal,
  onOpenGit,
  onOpenNote,
  onOpenGraph,
}: WindowContentRouterProps) {
  const fileData = useStore(workspaceSessionStore, (storeState) =>
    selectFileWindowStateByWorktree(storeState, activeWorktreeId, win.id),
  );
  const noteData = useStore(workspaceSessionStore, (storeState) =>
    selectNoteWindowStateByWorktree(storeState, activeWorktreeId, win.id),
  );
  const uiState = useStore(workspaceSessionStore, (storeState) =>
    selectSearchUiStateByWorktree(storeState, activeWorktreeId, win.id),
  );
  const threadConversation = useStore(workspaceSessionStore, (storeState) =>
    win.kind === "chat"
      ? selectThreadConversationByWorktree(
          storeState,
          activeWorktreeId,
          win.threadId,
        )
      : undefined,
  );

  if (win.kind === "file") {
    return (
      <FileWindowContent
        filePath={win.filePath}
        content={fileData?.content ?? null}
        isLoading={fileData?.isLoading}
        error={fileData?.error}
        isDirty={win.isDirty}
        isReadOnly={win.isReadOnly}
        onContentChange={(content) => onFileContentChange(win.id, content)}
        onSave={() => onFileSave(win.id, win.filePath)}
      />
    );
  }

  if (win.kind === "chat") {
    const conversation = threadConversation ?? EMPTY_THREAD_CONVERSATION;

    return (
      <ChatWindowContent
        threadTitle={getThreadWindowTitle(threadLookup.get(win.threadId))}
        isActiveThread={win.threadId === activeThreadId}
        messages={conversation.messages}
        isStreaming={conversation.status === "streaming"}
        lastError={conversation.lastError}
        className="h-full"
      />
    );
  }

  if (win.kind === "note") {
    return (
      <NoteWindowContent
        content={noteData?.content ?? ""}
        onContentChange={(content) => onNoteContentChange(win.id, content)}
        onSave={() => onNoteSave(win.id, win.storagePath)}
      />
    );
  }

  if (win.kind === "terminal") {
    return (
      <TerminalWindowContent
        terminalId={win.terminalId}
        cwd={win.cwd}
        backend={win.backend}
        linkedThreadId={win.linkedThreadId}
        ownerWindowId={win.id}
      />
    );
  }

  if (win.kind === "git") {
    return (
      <TerminalWindowContent
        terminalId={win.terminalId}
        cwd={win.repositoryPath}
        backend="lazygit"
        ownerWindowId={win.id}
      />
    );
  }

  if (win.kind === "search") {
    return (
      <SearchWindowContent
        query={win.query}
        results={win.results}
        isLoading={uiState?.isLoading}
        selectedIndex={uiState?.selectedIndex}
        onQueryChange={(query) => void onSearchQueryChange(win.id, query)}
        onSelect={onSearchSelect}
        onHover={(index) => onSearchHover(win.id, index)}
        onKeyDown={onSearchKeyDown(win.id)}
        shouldFocusInput={win.isFocused}
        actions={[
          {
            id: "terminal",
            label: "Terminal",
            onSelect: onOpenTerminal,
          },
          {
            id: "git",
            label: "Git",
            onSelect: onOpenGit,
          },
          {
            id: "note",
            label: "Note",
            onSelect: onOpenNote,
          },
          {
            id: "graph",
            label: "Graph",
            onSelect: onOpenGraph,
          },
        ]}
      />
    );
  }

  if (win.kind === "graph") {
    return <GraphWindowContent nodes={graphNodes} links={graphLinks} />;
  }

  return (
    <div className="p-4 text-muted-foreground">Window type: {win.kind}</div>
  );
}
