/**
 * Terminal session descriptors for local terminal management.
 */

import type { LinkColor } from "./window.js";

/**
 * Terminal backend type.
 */
export type TerminalBackend = "shell" | "pi";

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
