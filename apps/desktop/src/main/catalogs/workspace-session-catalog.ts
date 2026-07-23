import path from "node:path";
import {
  createEmptyWorkspaceSession,
  DocumentCatalog,
  type VersionedEnvelope,
  type WorkspaceSession,
  wrapEnvelope,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";
import { recoverCorruptFile } from "./recover-corrupt-file";
import {
  createVersionedDocumentStore,
  validateVersionedDocument,
} from "./versioned-document-store";
import { sanitizeWorkspaceWindow } from "./workspace-session-window-sanitizer";

const CURRENT_VERSION = 1;
const CATALOG_NAME = "workspace-session-catalog";

type WorkspaceSessionDocumentData = {
  sessions: WorkspaceSession[];
};

type WorkspaceSessionEnvelope = VersionedEnvelope<WorkspaceSessionDocumentData>;

const DEFAULT_DATA: WorkspaceSessionDocumentData = {
  sessions: [],
};

function normalizePathId(value: string): string {
  const resolved = path.resolve(value);
  return resolved.replace(/[\\/]+$/, "") || resolved;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function dropLegacySearchWindows(session: WorkspaceSession): WorkspaceSession {
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
    layout: {
      ...session.layout,
      windows,
      focusedWindowId,
    },
  };
}

export function sanitizeWorkspaceSession(
  session: unknown,
): WorkspaceSession | null {
  if (!isRecord(session)) {
    return null;
  }

  const worktreeId = getString(session.worktreeId);
  if (!worktreeId) {
    return null;
  }

  const normalizedWorktreeId = normalizePathId(worktreeId);
  const defaults = createEmptyWorkspaceSession(normalizedWorktreeId);
  const layout = isRecord(session.layout) ? session.layout : {};
  const sidebar = isRecord(session.sidebar) ? session.sidebar : {};
  const search = isRecord(session.search) ? session.search : {};
  const promptDrafts = isRecord(session.promptDrafts)
    ? session.promptDrafts
    : {};
  const files = isRecord(session.files) ? session.files : {};
  const notes = isRecord(session.notes) ? session.notes : {};
  const recoveryDrafts = isRecord(session.recoveryDrafts)
    ? session.recoveryDrafts
    : {};

  return dropLegacySearchWindows({
    worktreeId: normalizedWorktreeId,
    layout: {
      windows: Array.isArray(layout.windows)
        ? layout.windows.flatMap((window) => {
            const sanitized = sanitizeWorkspaceWindow(window);
            return sanitized ? [sanitized] : [];
          })
        : defaults.layout.windows,
      nextZIndex: getNumber(layout.nextZIndex) ?? defaults.layout.nextZIndex,
      focusedWindowId:
        getString(layout.focusedWindowId) ?? defaults.layout.focusedWindowId,
      snapGridSize:
        getNumber(layout.snapGridSize) ?? defaults.layout.snapGridSize,
      zoom: getNumber(layout.zoom) ?? defaults.layout.zoom,
      panX: getNumber(layout.panX) ?? defaults.layout.panX,
      panY: getNumber(layout.panY) ?? defaults.layout.panY,
    },
    sidebar: {
      activePanel:
        sidebar.activePanel === "files" ||
        sidebar.activePanel === "notes" ||
        sidebar.activePanel === "search"
          ? sidebar.activePanel
          : defaults.sidebar.activePanel,
      isCollapsed:
        getBoolean(sidebar.isCollapsed) ?? defaults.sidebar.isCollapsed,
    },
    promptDrafts: Object.fromEntries(
      Object.entries(promptDrafts).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    search: {
      query: getString(search.query) ?? defaults.search.query,
      selectedPath:
        search.selectedPath === null
          ? null
          : (getString(search.selectedPath) ?? defaults.search.selectedPath),
    },
    files: Object.fromEntries(
      Object.entries(files).flatMap(([key, value]) => {
        if (!isRecord(value)) {
          return [];
        }
        const filePath = getString(value.filePath);
        const scrollTop = getNumber(value.scrollTop);
        if (!filePath || scrollTop === undefined) {
          return [];
        }
        return [[key, { filePath, scrollTop }]];
      }),
    ),
    notes: Object.fromEntries(
      Object.entries(notes).flatMap(([key, value]) => {
        if (!isRecord(value)) {
          return [];
        }
        const noteId = getString(value.noteId);
        const draft = getString(value.draft);
        if (!noteId || draft === undefined) {
          return [];
        }
        return [[key, { noteId, draft }]];
      }),
    ),
    recoveryDrafts: Object.fromEntries(
      Object.entries(recoveryDrafts).flatMap(([key, value]) => {
        if (!isRecord(value)) {
          return [];
        }
        const kind = getString(value.kind);
        const text = getString(value.text);
        const updatedAt = getNumber(value.updatedAt);
        if (
          (kind !== "thread" && kind !== "note") ||
          text === undefined ||
          updatedAt === undefined
        ) {
          return [];
        }
        return [[key, { kind, text, updatedAt }]];
      }),
    ),
  });
}

export function decodeWorkspaceSessionDocumentData(
  raw: unknown,
): WorkspaceSessionDocumentData | null {
  if (!isRecord(raw)) {
    return null;
  }

  const sessionsRaw = raw.sessions;
  if (!Array.isArray(sessionsRaw)) {
    return null;
  }

  const sessions = sessionsRaw.flatMap((session) => {
    const sanitized = sanitizeWorkspaceSession(session);
    return sanitized ? [sanitized] : [];
  });

  return { sessions };
}

type WorkspaceSessionMutation = (
  sessions: WorkspaceSession[],
) => WorkspaceSession[];

export class WorkspaceSessionCatalog {
  private readonly store: ReturnType<
    typeof createVersionedDocumentStore<WorkspaceSessionDocumentData>
  >;

  private readonly catalog: DocumentCatalog<
    WorkspaceSessionEnvelope,
    WorkspaceSession[],
    WorkspaceSessionMutation
  >;

  constructor(userDataPath: string) {
    const filePath = path.join(
      userDataPath,
      "catalog",
      "workspace-sessions.json",
    );

    recoverCorruptFile(filePath, CATALOG_NAME, {
      currentVersion: CURRENT_VERSION,
      decode: decodeWorkspaceSessionDocumentData,
    });

    const file = new PersistentJsonFile<unknown>({
      filePath,
      defaultValue: wrapEnvelope(DEFAULT_DATA, CURRENT_VERSION),
      validate: (raw): raw is unknown =>
        validateVersionedDocument(raw, decodeWorkspaceSessionDocumentData),
    });

    this.store = createVersionedDocumentStore(file, {
      currentVersion: CURRENT_VERSION,
      defaultData: DEFAULT_DATA,
      decode: decodeWorkspaceSessionDocumentData,
    });

    this.catalog = new DocumentCatalog({
      store: this.store,
      select: (document) => document.data.sessions,
      applyUpdate: (document, mutate) => ({
        schemaVersion: CURRENT_VERSION,
        data: {
          sessions: mutate(document.data.sessions),
        },
      }),
    });
  }

  list(): WorkspaceSession[] {
    return this.catalog.get();
  }

  get(worktreeId: string): WorkspaceSession | null {
    const normalizedWorktreeId = normalizePathId(worktreeId);
    return (
      this.list().find(
        (session) => session.worktreeId === normalizedWorktreeId,
      ) ?? null
    );
  }

  save(session: WorkspaceSession): WorkspaceSession {
    const nextSession = sanitizeWorkspaceSession(session);
    if (!nextSession) {
      throw new Error("Workspace session must include a worktreeId");
    }
    const normalizedWorktreeId = nextSession.worktreeId;

    const sessions = this.catalog.update((currentSessions) => {
      const nextSessions = currentSessions.filter(
        (entry) => entry.worktreeId !== normalizedWorktreeId,
      );
      nextSessions.push(nextSession);
      return nextSessions;
    });

    return (
      sessions.find((entry) => entry.worktreeId === normalizedWorktreeId) ??
      nextSession
    );
  }

  replaceAll(sessions: WorkspaceSession[]): WorkspaceSession[] {
    const normalizedSessions = sessions.flatMap((session) => {
      const sanitized = sanitizeWorkspaceSession(session);
      return sanitized ? [sanitized] : [];
    });

    return this.store.update(() =>
      wrapEnvelope({ sessions: normalizedSessions }, CURRENT_VERSION),
    ).data.sessions;
  }

  remove(worktreeId: string): void {
    const normalizedWorktreeId = normalizePathId(worktreeId);
    this.catalog.update((sessions) =>
      sessions.filter((entry) => entry.worktreeId !== normalizedWorktreeId),
    );
  }

  removeByWorktreeIds(worktreeIds: readonly string[]): void {
    const normalizedIds = new Set(worktreeIds.map(normalizePathId));
    this.catalog.update((sessions) =>
      sessions.filter((entry) => !normalizedIds.has(entry.worktreeId)),
    );
  }
}
