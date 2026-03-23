import type { WindowLayoutState, WorkspaceWindow } from "./window.js";

export interface RepositoryDisplayMetadata {
  customName: string | null;
  icon: string | null;
  accentColor: string | null;
}

export interface RepositoryPreferences extends RepositoryDisplayMetadata {
  repositoryId: string;
}

export interface AppPreferences {
  leftSidebarWidth?: number | null;
  settings?: Record<string, unknown> | null;
}

export interface WorkspaceSidebarState {
  activePanel: "files" | "notes" | "search" | null;
  isCollapsed: boolean;
}

export interface WorkspaceSearchState {
  query: string;
  selectedPath: string | null;
}

export interface WorkspaceFileState {
  filePath: string;
  scrollTop: number;
}

export interface WorkspaceNoteState {
  noteId: string;
  draft: string;
}

export interface WorkspaceRecoveryDraft {
  kind: "thread" | "note";
  text: string;
  updatedAt: number;
}

export interface WorkspaceSession {
  worktreeId: string;
  layout: WindowLayoutState;
  sidebar: WorkspaceSidebarState;
  promptDrafts: Record<string, string>;
  search: WorkspaceSearchState;
  files: Record<string, WorkspaceFileState>;
  notes: Record<string, WorkspaceNoteState>;
  recoveryDrafts: Record<string, WorkspaceRecoveryDraft>;
}

export interface LegacyRepositoryPreferencesImport {
  repositoryId: string;
  customName?: string | null;
  icon?: string | null;
  accentColor?: string | null;
}

export interface LegacyPreferencesImport {
  leftSidebarWidth?: number | null;
  settings?: Record<string, unknown> | null;
  repositories?: LegacyRepositoryPreferencesImport[];
}

function normalizePathId(value: string): string {
  return value.replace(/[\\/]+$/, "") || value;
}

export function createEmptyWindowLayoutState(): WindowLayoutState {
  return {
    windows: [],
    nextZIndex: 1,
    focusedWindowId: null,
    snapGridSize: 24,
    zoom: 0.9,
    panX: 0,
    panY: 0,
  };
}

export function createEmptyWorkspaceSession(
  worktreeId: string,
): WorkspaceSession {
  return {
    worktreeId: normalizePathId(worktreeId),
    layout: createEmptyWindowLayoutState(),
    sidebar: {
      activePanel: null,
      isCollapsed: false,
    },
    promptDrafts: {},
    search: {
      query: "",
      selectedPath: null,
    },
    files: {},
    notes: {},
    recoveryDrafts: {},
  };
}

export function isFileBackedWindow(
  window: WorkspaceWindow,
): window is Extract<WorkspaceWindow, { filePath: string }> {
  return window.kind === "file" || window.kind === "image";
}
