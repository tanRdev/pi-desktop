import type {
  AgentMessageSnapshot,
  CanvasWindow,
  FileContent,
  SearchMatch,
  ThreadSnapshot,
} from "@pidesk/shared";
import type * as React from "react";
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

type ThreadConversationState = {
  messages: AgentMessageSnapshot[];
  status: string;
  lastError: string | null;
};

type FileWindowState = {
  content: FileContent | null;
  isLoading: boolean;
  error: string | null;
};

type NoteWindowState = {
  content: string;
  error: string | null;
};

type SearchUiState = {
  isLoading: boolean;
  selectedIndex: number;
};

export interface WindowContentRouterProps {
  win: CanvasWindow;
  activeThreadId: string | null;
  agent: ThreadConversationState;
  threadLookup: Map<string, ThreadSnapshot>;
  threadConversations: Map<string, ThreadConversationState>;
  fileContents: Map<string, FileWindowState>;
  noteContents: Map<string, NoteWindowState>;
  searchUiState: Map<string, SearchUiState>;
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
  activeThreadId,
  agent,
  threadLookup,
  threadConversations,
  fileContents,
  noteContents,
  searchUiState,
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
  if (win.kind === "file") {
    const fileData = fileContents.get(win.id);
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
    const conversation =
      win.threadId === activeThreadId
        ? agent
        : (threadConversations.get(win.threadId) ?? {
            messages: [],
            status: "idle",
            lastError: null,
          });

    return (
      <ChatWindowContent
        threadTitle={getThreadWindowTitle(threadLookup.get(win.threadId))}
        isActiveThread={win.threadId === activeThreadId}
        messages={conversation.messages}
        isStreaming={
          win.threadId === activeThreadId && conversation.status === "streaming"
        }
        lastError={conversation.lastError}
        className="h-full"
      />
    );
  }

  if (win.kind === "note") {
    const noteData = noteContents.get(win.id);
    return (
      <NoteWindowContent
        window={win}
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
    const uiState = searchUiState.get(win.id);
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
        autoFocus={win.isFocused}
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
