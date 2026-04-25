import type { WorkspaceSession } from "@pi-desktop/shared";
import {
  createEmptyWindowLayoutState,
  createEmptyWorkspaceSession,
} from "@pi-desktop/shared";

/**
 * Persistence schema version for the renderer workspace session model.
 *
 * The on-disk shape is owned by the main process persistence layer, so we
 * cannot rely on a version tag being present. The migration path here is
 * defensive: it accepts a loosely-typed `unknown` snapshot (optionally
 * wrapped in `{ schemaVersion, session }`) and returns a valid
 * `WorkspaceSession`, applying v1->current normalization as needed.
 *
 * Bump this constant when the shape changes and add a new branch to
 * `migrateWorkspaceSessionSnapshot`.
 */
export const WORKSPACE_SESSION_SCHEMA_VERSION = 2 as const;

export type WorkspaceSessionSchemaVersion = 1 | 2;

export interface VersionedWorkspaceSessionSnapshot {
  schemaVersion: WorkspaceSessionSchemaVersion;
  session: WorkspaceSession;
}

export type WorkspaceSessionSnapshot =
  | WorkspaceSession
  | VersionedWorkspaceSessionSnapshot;

type UnknownRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseSchemaVersion(value: unknown): WorkspaceSessionSchemaVersion {
  if (value === 1) {
    return 1;
  }
  if (value === 2) {
    return 2;
  }
  return 1;
}

function coerceBase(value: UnknownRecord): {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isFocused: boolean;
  state: "normal" | "minimized" | "maximized";
  linkColor?: "blue" | "green" | "orange" | "pink" | "purple" | "yellow";
  linkTargetIds?: string[];
} | null {
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.title !== "string") return null;
  if (typeof value.x !== "number") return null;
  if (typeof value.y !== "number") return null;
  if (typeof value.width !== "number") return null;
  if (typeof value.height !== "number") return null;
  if (typeof value.zIndex !== "number") return null;

  const state =
    value.state === "minimized" || value.state === "maximized"
      ? value.state
      : "normal";

  const linkColor =
    value.linkColor === "blue" ||
    value.linkColor === "green" ||
    value.linkColor === "orange" ||
    value.linkColor === "pink" ||
    value.linkColor === "purple" ||
    value.linkColor === "yellow"
      ? value.linkColor
      : undefined;

  const linkTargetIds = Array.isArray(value.linkTargetIds)
    ? value.linkTargetIds.filter((id): id is string => typeof id === "string")
    : undefined;

  return {
    id: value.id,
    title: value.title,
    x: value.x,
    y: value.y,
    width: value.width,
    height: value.height,
    zIndex: value.zIndex,
    isFocused: value.isFocused === true,
    state,
    ...(linkColor ? { linkColor } : {}),
    ...(linkTargetIds ? { linkTargetIds } : {}),
  };
}

function coerceWindow(
  value: unknown,
): WorkspaceSession["layout"]["windows"][number] | null {
  if (!isRecord(value)) return null;
  const kind = value.kind;
  // Drop legacy `search` windows during migration; the renderer no longer
  // supports them as persisted entries because they are launcher overlays now.
  if (kind === "search") return null;

  const base = coerceBase(value);
  if (!base) return null;

  switch (kind) {
    case "file": {
      if (typeof value.filePath !== "string") return null;
      return {
        ...base,
        kind: "file",
        filePath: value.filePath,
        isDirty: value.isDirty === true,
        ...(typeof value.encoding === "string"
          ? { encoding: value.encoding }
          : {}),
        ...(typeof value.isReadOnly === "boolean"
          ? { isReadOnly: value.isReadOnly }
          : {}),
      };
    }
    case "terminal": {
      if (typeof value.terminalId !== "string") return null;
      const backend =
        value.backend === "shell" || value.backend === "pi"
          ? value.backend
          : "shell";
      return {
        ...base,
        kind: "terminal",
        terminalId: value.terminalId,
        backend,
        cwd: typeof value.cwd === "string" ? value.cwd : "",
      };
    }
    case "chat": {
      if (typeof value.threadId !== "string") return null;
      return { ...base, kind: "chat", threadId: value.threadId };
    }
    case "note": {
      if (typeof value.noteId !== "string") return null;
      return {
        ...base,
        kind: "note",
        noteId: value.noteId,
        isDirty: value.isDirty === true,
        ...(typeof value.storagePath === "string"
          ? { storagePath: value.storagePath }
          : {}),
      };
    }
    case "git": {
      if (typeof value.repositoryPath !== "string") return null;
      return {
        ...base,
        kind: "git",
        repositoryPath: value.repositoryPath,
      };
    }
    case "graph": {
      const rawFilters = isRecord(value.filters) ? value.filters : {};
      return {
        ...base,
        kind: "graph",
        filters: {
          showFiles: rawFilters.showFiles !== false,
          showTerminals: rawFilters.showTerminals !== false,
          showNotes: rawFilters.showNotes !== false,
          showThreadLinks: rawFilters.showThreadLinks !== false,
          showMentions: rawFilters.showMentions !== false,
        },
      };
    }
    case "image": {
      if (typeof value.filePath !== "string") return null;
      const dimensions =
        isRecord(value.dimensions) &&
        typeof value.dimensions.width === "number" &&
        typeof value.dimensions.height === "number"
          ? { width: value.dimensions.width, height: value.dimensions.height }
          : undefined;
      return {
        ...base,
        kind: "image",
        filePath: value.filePath,
        ...(dimensions ? { dimensions } : {}),
        ...(typeof value.mimeType === "string"
          ? { mimeType: value.mimeType }
          : {}),
      };
    }
    default:
      return null;
  }
}

function coerceLayout(value: unknown): WorkspaceSession["layout"] {
  const fallback = createEmptyWindowLayoutState();
  if (!isRecord(value)) {
    return fallback;
  }

  const rawWindows = Array.isArray(value.windows) ? value.windows : [];
  const windows = rawWindows
    .map(coerceWindow)
    .filter(
      (window): window is WorkspaceSession["layout"]["windows"][number] =>
        window !== null,
    );

  return {
    windows,
    nextZIndex:
      typeof value.nextZIndex === "number" && Number.isFinite(value.nextZIndex)
        ? value.nextZIndex
        : fallback.nextZIndex,
    focusedWindowId: stringOrNull(value.focusedWindowId),
    snapGridSize:
      typeof value.snapGridSize === "number" && value.snapGridSize > 0
        ? value.snapGridSize
        : fallback.snapGridSize,
    zoom:
      typeof value.zoom === "number" && value.zoom > 0
        ? value.zoom
        : fallback.zoom,
    panX: typeof value.panX === "number" ? value.panX : fallback.panX,
    panY: typeof value.panY === "number" ? value.panY : fallback.panY,
  };
}

function coerceStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function coerceSidebar(value: unknown): WorkspaceSession["sidebar"] {
  if (!isRecord(value)) {
    return { activePanel: null, isCollapsed: false };
  }
  const activePanel = value.activePanel;
  const panel: WorkspaceSession["sidebar"]["activePanel"] =
    activePanel === "files" ||
    activePanel === "notes" ||
    activePanel === "search"
      ? activePanel
      : null;
  return {
    activePanel: panel,
    isCollapsed: value.isCollapsed === true,
  };
}

function coerceSearch(value: unknown): WorkspaceSession["search"] {
  if (!isRecord(value)) {
    return { query: "", selectedPath: null };
  }
  return {
    query: typeof value.query === "string" ? value.query : "",
    selectedPath: stringOrNull(value.selectedPath),
  };
}

function coerceFiles(value: unknown): WorkspaceSession["files"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["files"] = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.filePath !== "string") continue;
    out[key] = {
      filePath: entry.filePath,
      scrollTop: typeof entry.scrollTop === "number" ? entry.scrollTop : 0,
    };
  }
  return out;
}

function coerceNotes(value: unknown): WorkspaceSession["notes"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["notes"] = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.noteId !== "string") continue;
    out[key] = {
      noteId: entry.noteId,
      draft: typeof entry.draft === "string" ? entry.draft : "",
    };
  }
  return out;
}

function coerceRecoveryDrafts(
  value: unknown,
): WorkspaceSession["recoveryDrafts"] {
  if (!isRecord(value)) {
    return {};
  }
  const out: WorkspaceSession["recoveryDrafts"] = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const kind = entry.kind;
    if (kind !== "thread" && kind !== "note") continue;
    if (typeof entry.text !== "string") continue;
    if (typeof entry.updatedAt !== "number") continue;
    out[key] = { kind, text: entry.text, updatedAt: entry.updatedAt };
  }
  return out;
}

function migrateRawSession(raw: unknown): WorkspaceSession {
  if (!isRecord(raw) || typeof raw.worktreeId !== "string") {
    return createEmptyWorkspaceSession("");
  }

  return {
    worktreeId: raw.worktreeId,
    layout: coerceLayout(raw.layout),
    sidebar: coerceSidebar(raw.sidebar),
    promptDrafts: coerceStringRecord(raw.promptDrafts),
    search: coerceSearch(raw.search),
    files: coerceFiles(raw.files),
    notes: coerceNotes(raw.notes),
    recoveryDrafts: coerceRecoveryDrafts(raw.recoveryDrafts),
  };
}

/**
 * Apply a v1 -> v2 migration to a normalized session. v2 guarantees:
 *   - no `search` kind windows in `layout.windows`
 *   - `focusedWindowId` points to an existing window or is null
 *
 * The concrete normalization already happens in `migrateRawSession` +
 * `sanitizeWorkspaceSessionLayout`; this hook exists so future versions
 * can plug in additional transforms without rewriting callers.
 */
function applyV1ToV2(session: WorkspaceSession): WorkspaceSession {
  const windows = session.layout.windows.filter(
    (window) => window.kind !== "search",
  );
  const focusedWindowId =
    session.layout.focusedWindowId &&
    windows.some((window) => window.id === session.layout.focusedWindowId)
      ? session.layout.focusedWindowId
      : null;
  return {
    ...session,
    layout: { ...session.layout, windows, focusedWindowId },
  };
}

/**
 * Run the full migration pipeline on an unknown persisted value.
 * Returns `null` if the value is unrecoverable (e.g. missing worktreeId).
 */
export function migrateWorkspaceSessionSnapshot(
  raw: unknown,
): WorkspaceSession | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let version: WorkspaceSessionSchemaVersion = 1;
  let inner: unknown = raw;

  if (
    isRecord(raw) &&
    "schemaVersion" in raw &&
    "session" in raw &&
    isRecord(raw.session)
  ) {
    version = parseSchemaVersion(raw.schemaVersion);
    inner = raw.session;
  }

  let session = migrateRawSession(inner);
  if (!session.worktreeId) {
    return null;
  }

  if (version < 2) {
    session = applyV1ToV2(session);
  }

  return session;
}

function isLegacySearchWindow(
  window: WorkspaceSession["layout"]["windows"][number],
): boolean {
  return window.kind === "search";
}

function getFocusedWindowAfterSanitizingSearchWindows(
  windows: WorkspaceSession["layout"]["windows"],
  focusedWindowId: string | null,
): string | null {
  if (
    focusedWindowId &&
    windows.some((window) => window.id === focusedWindowId)
  ) {
    return focusedWindowId;
  }

  return (
    [...windows]
      .filter((window) => window.state !== "minimized")
      .sort((left, right) => right.zIndex - left.zIndex)[0]?.id ?? null
  );
}

export function sanitizeWorkspaceSessionLayout(
  layout: WorkspaceSession["layout"],
): WorkspaceSession["layout"] {
  const windows = layout.windows.filter(
    (window) => !isLegacySearchWindow(window),
  );

  if (windows.length === layout.windows.length) {
    return layout;
  }

  return {
    ...layout,
    windows,
    focusedWindowId: getFocusedWindowAfterSanitizingSearchWindows(
      windows,
      layout.focusedWindowId,
    ),
  };
}
