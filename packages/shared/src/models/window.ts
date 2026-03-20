import type { ImageDimensions } from "./fs.js";
/**
 * Canvas window descriptors for the PiDesk window manager.
 * Each window is a floating, draggable, resizable surface on the canvas.
 */

export type WindowKind =
  | "file"
  | "terminal"
  | "chat"
  | "note"
  | "git"
  | "search"
  | "graph"
  | "image";

export type WindowState = "normal" | "minimized" | "maximized";

/**
 * Link color for visual association between windows and Pi threads.
 */
export type LinkColor =
  | "blue"
  | "green"
  | "orange"
  | "pink"
  | "purple"
  | "yellow";

/**
 * Base window descriptor shared by all window kinds.
 */
export interface CanvasWindowBase {
  /** Unique window identifier */
  id: string;
  /** Window kind determines content and behavior */
  kind: WindowKind;
  /** Window title (displayed in chrome) */
  title: string;
  /** X position on canvas (pixels) */
  x: number;
  /** Y position on canvas (pixels) */
  y: number;
  /** Window width (pixels) */
  width: number;
  /** Window height (pixels) */
  height: number;
  /** Z-order (higher = on top) */
  zIndex: number;
  /** Whether this window has focus */
  isFocused: boolean;
  /** Current window state */
  state: WindowState;
  /** Optional link color for Pi/terminal associations */
  linkColor?: LinkColor;
  /** IDs of linked windows/threads */
  linkTargetIds?: string[];
}

/**
 * File window - displays code/text/markdown files with Monaco or TipTap.
 */
export interface FileWindow extends CanvasWindowBase {
  kind: "file";
  /** Absolute file path */
  filePath: string;
  /** Whether the file has unsaved changes */
  isDirty: boolean;
  /** File encoding */
  encoding?: string;
  /** Whether the file is read-only */
  isReadOnly?: boolean;
}

/**
 * Terminal window - tmux-backed shell or special mode (lazygit, pi).
 */
export interface TerminalWindow extends CanvasWindowBase {
  kind: "terminal";
  /** Terminal session ID (maps to tmux session or node-pty) */
  terminalId: string;
  /** Terminal backend mode */
  backend: "shell" | "lazygit" | "pi-linked" | "tmux-attach";
  /** Working directory */
  cwd: string;
  /** Linked Pi thread ID if backend is pi-linked */
  linkedThreadId?: string;
  /** tmux session name if using tmux */
  tmuxSessionName?: string;
}

/**
 * Chat window - renders a Pi thread transcript inside a floating window.
 */
export interface ChatWindow extends CanvasWindowBase {
  kind: "chat";
  /** Linked Pi thread ID */
  threadId: string;
}

/**
 * Note window - plain Markdown editor with file-backed autosave.
 */
export interface NoteWindow extends CanvasWindowBase {
  kind: "note";
  /** Note document ID */
  noteId: string;
  /** Storage path (relative to workspace notes dir) */
  storagePath?: string;
  /** Whether the note has unsaved changes */
  isDirty: boolean;
}

/**
 * Git window - lazygit in a terminal window.
 */
export interface GitWindow extends CanvasWindowBase {
  kind: "git";
  /** Terminal session ID backing this git window */
  terminalId: string;
  /** Repository path */
  repositoryPath: string;
}

/**
 * Search window - fff-backed fuzzy file search.
 */
export interface SearchWindow extends CanvasWindowBase {
  kind: "search";
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResult[];
}

/**
 * Graph window - D3 force visualization of workspace relationships.
 */
export interface GraphWindow extends CanvasWindowBase {
  kind: "graph";
  /** Graph filter settings */
  filters: GraphFilters;
}

/**
 * Image window - sharp-backed image preview.
 */
export interface ImageWindow extends CanvasWindowBase {
  kind: "image";
  /** Absolute file path */
  filePath: string;
  /** Image dimensions */
  dimensions?: ImageDimensions;
  /** MIME type */
  mimeType?: string;
}

/**
 * Union type for all canvas windows.
 */
export type CanvasWindow =
  | FileWindow
  | TerminalWindow
  | ChatWindow
  | NoteWindow
  | GitWindow
  | SearchWindow
  | GraphWindow
  | ImageWindow;

/**
 * Search result from fff fuzzy file search.
 */
export interface SearchResult {
  /** File path (absolute) */
  path: string;
  /** File name */
  name: string;
  /** Match score (higher = better match) */
  score: number;
  /** File type */
  type: "file" | "directory";
  /** File extension */
  extension?: string;
}

/**
 * Graph visualization filters.
 */
export interface GraphFilters {
  /** Show file windows */
  showFiles: boolean;
  /** Show terminal windows */
  showTerminals: boolean;
  /** Show notes */
  showNotes: boolean;
  /** Show Pi thread links */
  showThreadLinks: boolean;
  /** Show mention relationships */
  showMentions: boolean;
}

/**
 * Window layout state for the canvas.
 */
export interface WindowLayoutState {
  /** All open windows */
  windows: CanvasWindow[];
  /** Next z-index to assign */
  nextZIndex: number;
  /** ID of the focused window (if any) */
  focusedWindowId: string | null;
  /** Grid size for snapping (pixels) */
  snapGridSize: number;
  /** Canvas zoom scale (1.0 = 100%) */
  zoom: number;
  /** Canvas pan offset X */
  panX: number;
  /** Canvas pan offset Y */
  panY: number;
}

/**
 * Action to create a new window.
 */
export type CreateWindowAction =
  | { kind: "file"; filePath: string }
  | { kind: "terminal"; backend: TerminalWindow["backend"]; cwd?: string }
  | { kind: "chat"; threadId: string; title?: string }
  | { kind: "note" }
  | { kind: "git"; repositoryPath: string }
  | { kind: "search" }
  | { kind: "graph" }
  | { kind: "image"; filePath: string };

/**
 * Window position for drag/snap operations.
 */
export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Snap preview during drag.
 */
export interface SnapPreview {
  /** Snapped position */
  position: WindowPosition;
  /** Whether snap is active */
  isActive: boolean;
}
