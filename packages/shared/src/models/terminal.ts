/**
 * Terminal session descriptors for tmux-backed terminal management.
 */

import type { LinkColor } from "./window.js";

/**
 * Terminal backend type.
 */
export type TerminalBackend = "shell" | "lazygit" | "pi-linked" | "tmux-attach";

/**
 * Terminal session state.
 */
export type TerminalSessionStatus = "starting" | "ready" | "exited" | "error";

/**
 * Terminal session descriptor for tracking terminal windows.
 */
export interface TerminalSession {
  /** Unique terminal session ID */
  id: string;
  /** Backend type */
  backend: TerminalBackend;
  /** Working directory */
  cwd: string;
  /** tmux session name (if using tmux) */
  tmuxSessionName?: string;
  /** Linked Pi thread ID (if pi-linked backend) */
  linkedThreadId?: string;
  /** Session status */
  status: TerminalSessionStatus;
  /** Link color for visual association */
  linkColor?: LinkColor;
  /** Owner window ID */
  ownerWindowId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt?: number;
}

/**
 * Terminal creation options.
 */
export interface TerminalCreateOptions {
  /** Terminal ID (generated if not provided) */
  id?: string;
  /** Backend type */
  backend?: TerminalBackend;
  /** Working directory */
  cwd?: string;
  /** Initial columns */
  cols: number;
  /** Initial rows */
  rows: number;
  /** Owner window ID */
  ownerWindowId: string;
  /** Pi thread ID to link (for pi-linked backend) */
  linkedThreadId?: string;
}

/**
 * Terminal resize event.
 */
export interface TerminalResizeEvent {
  id: string;
  cols: number;
  rows: number;
}

/**
 * Terminal data event.
 */
export interface TerminalDataEvent {
  type: "data";
  id: string;
  data: string;
}

/**
 * Terminal exit event.
 */
export interface TerminalExitEvent {
  type: "exit";
  id: string;
  exitCode: number;
}

/**
 * Terminal event union.
 */
export type TerminalEvent = TerminalDataEvent | TerminalExitEvent;

/**
 * Pi-linked terminal routing request.
 */
export interface PiTerminalRouteRequest {
  /** Terminal ID to route to */
  terminalId: string;
  /** Prompt text to send */
  prompt: string;
  /** Whether to start Pi if not linked */
  startPiIfNotLinked: boolean;
}

/**
 * Pi-linked terminal routing result.
 */
export interface PiTerminalRouteResult {
  /** Whether routing succeeded */
  success: boolean;
  /** Thread ID that received the prompt */
  threadId?: string;
  /** Error message if failed */
  error?: string;
}
