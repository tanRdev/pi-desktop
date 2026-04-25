import type {
  ChatWindow,
  CreateWindowAction,
  FileWindow,
  GitWindow,
  GraphWindow,
  ImageWindow,
  NoteWindow,
  TerminalWindow,
  WorkspaceWindow,
  WorkspaceWindowBase,
} from "@pi-desktop/shared";

export interface WindowCreationOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const DEFAULT_WINDOW_WIDTH = 640;
const DEFAULT_WINDOW_HEIGHT = 420;
const DEFAULT_ZOOM = 0.9;

export function generateWindowId(kind: WorkspaceWindow["kind"]): string {
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getDefaultWindowPosition(existingWindows: WorkspaceWindow[]): {
  x: number;
  y: number;
} {
  const cascadeOffset = 48;
  const maxOffset = 288;

  const count = existingWindows.length;
  const offset = Math.min(count * cascadeOffset, maxOffset);

  return {
    x: 160 + offset,
    y: 120 + offset,
  };
}

export function getCenteredWindowPosition({
  viewportWidth,
  viewportHeight,
  windowWidth = DEFAULT_WINDOW_WIDTH,
  windowHeight = DEFAULT_WINDOW_HEIGHT,
  zoom = DEFAULT_ZOOM,
  panX = 0,
  panY = 0,
}: {
  viewportWidth: number;
  viewportHeight: number;
  windowWidth?: number;
  windowHeight?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
}): { x: number; y: number } {
  const safeZoom = zoom > 0 ? zoom : DEFAULT_ZOOM;

  return {
    x: Math.round(
      (viewportWidth / safeZoom - windowWidth) / 2 - panX / safeZoom,
    ),
    y: Math.round(
      (viewportHeight / safeZoom - windowHeight) / 2 - panY / safeZoom,
    ),
  };
}

export function createWindowFromAction(
  action: CreateWindowAction,
  existingWindows: WorkspaceWindow[],
  nextZIndex: number,
  cwd?: string,
  options?: WindowCreationOptions,
): WorkspaceWindow {
  const id = generateWindowId(action.kind);
  const position = getDefaultWindowPosition(existingWindows);

  const base: Omit<WorkspaceWindowBase, "kind"> = {
    id,
    title: "",
    x: options?.x ?? position.x,
    y: options?.y ?? position.y,
    width: options?.width ?? DEFAULT_WINDOW_WIDTH,
    height: options?.height ?? DEFAULT_WINDOW_HEIGHT,
    zIndex: nextZIndex,
    isFocused: true,
    state: "normal",
  };

  switch (action.kind) {
    case "file": {
      const win: FileWindow = {
        ...base,
        kind: "file",
        title: action.filePath.split(/[/\\]/).pop() ?? action.filePath,
        filePath: action.filePath,
        isDirty: false,
      };
      return win;
    }
    case "terminal": {
      const win: TerminalWindow = {
        ...base,
        kind: "terminal",
        title: "Terminal",
        terminalId: id,
        backend: action.backend,
        cwd: action.cwd ?? cwd ?? "/",
      };
      return win;
    }
    case "chat": {
      const win: ChatWindow = {
        ...base,
        kind: "chat",
        title: action.title ?? "Chat",
        threadId: action.threadId,
      };
      return win;
    }
    case "note": {
      const win: NoteWindow = {
        ...base,
        kind: "note",
        title: "New Note",
        noteId: id,
        isDirty: false,
      };
      return win;
    }
    case "git": {
      const win: GitWindow = {
        ...base,
        kind: "git",
        title: "Git",
        repositoryPath: action.repositoryPath,
      };
      return win;
    }
    case "search": {
      throw new Error(
        "Search windows are overlay-only. Use the launcher overlay instead.",
      );
    }
    case "graph": {
      const win: GraphWindow = {
        ...base,
        kind: "graph",
        title: "Graph",
        filters: {
          showFiles: true,
          showTerminals: true,
          showNotes: true,
          showThreadLinks: true,
          showMentions: true,
        },
      };
      return win;
    }
    case "image": {
      const win: ImageWindow = {
        ...base,
        kind: "image",
        title: action.filePath.split(/[/\\]/).pop() ?? action.filePath,
        filePath: action.filePath,
      };
      return win;
    }
  }
}
