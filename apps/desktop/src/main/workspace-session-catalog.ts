import path from "node:path";
import {
  createEmptyWorkspaceSession,
  type WorkspaceSession,
  type WorkspaceWindow,
} from "@pi-desktop/shared";
import { PersistentJsonFile } from "./persistent-json-file";

type WorkspaceSessionDocument = {
  version: 1;
  sessions: WorkspaceSession[];
};

const DEFAULT_DOCUMENT: WorkspaceSessionDocument = {
  version: 1,
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

function sanitizeWindowBase(
  input: Record<string, unknown>,
): Omit<WorkspaceWindow, "kind"> | null {
  const id = getString(input.id);
  const title = getString(input.title);
  const x = getNumber(input.x);
  const y = getNumber(input.y);
  const width = getNumber(input.width);
  const height = getNumber(input.height);
  const zIndex = getNumber(input.zIndex);
  const isFocused = getBoolean(input.isFocused);
  const state = getString(input.state);

  if (
    !id ||
    !title ||
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    zIndex === undefined ||
    isFocused === undefined ||
    (state !== "normal" && state !== "minimized" && state !== "maximized")
  ) {
    return null;
  }

  const linkColor = getString(input.linkColor);
  const linkTargetIds = Array.isArray(input.linkTargetIds)
    ? input.linkTargetIds.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;

  return {
    id,
    title,
    x,
    y,
    width,
    height,
    zIndex,
    isFocused,
    state,
    ...(linkColor
      ? { linkColor: linkColor as WorkspaceWindow["linkColor"] }
      : {}),
    ...(linkTargetIds ? { linkTargetIds } : {}),
  };
}

function sanitizeWindow(input: unknown): WorkspaceWindow | null {
  if (!isRecord(input)) {
    return null;
  }

  const kind = getString(input.kind);
  const base = sanitizeWindowBase(input);
  if (!kind || !base) {
    return null;
  }

  switch (kind) {
    case "file": {
      const filePath = getString(input.filePath);
      const isDirty = getBoolean(input.isDirty);
      if (!filePath || isDirty === undefined) {
        return null;
      }
      return {
        ...base,
        kind,
        filePath,
        isDirty,
        ...(getString(input.encoding)
          ? { encoding: getString(input.encoding) }
          : {}),
        ...(getBoolean(input.isReadOnly) !== undefined
          ? { isReadOnly: getBoolean(input.isReadOnly) }
          : {}),
      };
    }
    case "terminal": {
      const terminalId = getString(input.terminalId);
      const backend = getString(input.backend);
      const cwd = getString(input.cwd);
      if (!terminalId || !cwd || (backend !== "shell" && backend !== "pi")) {
        return null;
      }
      return {
        ...base,
        kind,
        terminalId,
        backend,
        cwd,
      };
    }
    case "chat": {
      const threadId = getString(input.threadId);
      return threadId
        ? {
            ...base,
            kind,
            threadId,
          }
        : null;
    }
    case "note": {
      const noteId = getString(input.noteId);
      const isDirty = getBoolean(input.isDirty);
      if (!noteId || isDirty === undefined) {
        return null;
      }
      return {
        ...base,
        kind,
        noteId,
        isDirty,
        ...(getString(input.storagePath)
          ? { storagePath: getString(input.storagePath) }
          : {}),
      };
    }
    case "git": {
      const repositoryPath = getString(input.repositoryPath);
      return repositoryPath
        ? {
            ...base,
            kind,
            repositoryPath,
          }
        : null;
    }
    case "search": {
      const query = getString(input.query);
      const results = Array.isArray(input.results)
        ? input.results.flatMap((entry) => {
            if (!isRecord(entry)) {
              return [];
            }
            const pathValue = getString(entry.path);
            const name = getString(entry.name);
            const score = getNumber(entry.score);
            const type = getString(entry.type);
            if (
              !pathValue ||
              !name ||
              score === undefined ||
              (type !== "file" && type !== "directory")
            ) {
              return [];
            }
            return [
              {
                path: pathValue,
                name,
                score,
                type: type as "file" | "directory",
                ...(getString(entry.extension)
                  ? { extension: getString(entry.extension) }
                  : {}),
              },
            ];
          })
        : null;
      return query !== undefined && results !== null
        ? {
            ...base,
            kind,
            query,
            results,
          }
        : null;
    }
    case "graph": {
      const filters = isRecord(input.filters) ? input.filters : null;
      if (!filters) {
        return null;
      }
      const showFiles = getBoolean(filters.showFiles);
      const showTerminals = getBoolean(filters.showTerminals);
      const showNotes = getBoolean(filters.showNotes);
      const showThreadLinks = getBoolean(filters.showThreadLinks);
      const showMentions = getBoolean(filters.showMentions);
      if (
        showFiles === undefined ||
        showTerminals === undefined ||
        showNotes === undefined ||
        showThreadLinks === undefined ||
        showMentions === undefined
      ) {
        return null;
      }
      return {
        ...base,
        kind,
        filters: {
          showFiles,
          showTerminals,
          showNotes,
          showThreadLinks,
          showMentions,
        },
      };
    }
    case "image": {
      const filePath = getString(input.filePath);
      if (!filePath) {
        return null;
      }
      const dimensions = isRecord(input.dimensions)
        ? {
            width: getNumber(input.dimensions.width),
            height: getNumber(input.dimensions.height),
          }
        : null;
      return {
        ...base,
        kind,
        filePath,
        ...(dimensions?.width !== undefined && dimensions.height !== undefined
          ? {
              dimensions: {
                width: dimensions.width,
                height: dimensions.height,
              },
            }
          : {}),
        ...(getString(input.mimeType)
          ? { mimeType: getString(input.mimeType) }
          : {}),
      };
    }
    default:
      return null;
  }
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

  return {
    worktreeId: normalizedWorktreeId,
    layout: {
      windows: Array.isArray(layout.windows)
        ? layout.windows.flatMap((window) => {
            const sanitized = sanitizeWindow(window);
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
  };
}

export class WorkspaceSessionCatalog {
  private readonly store: PersistentJsonFile<WorkspaceSessionDocument>;

  constructor(userDataPath: string) {
    this.store = new PersistentJsonFile({
      filePath: path.join(userDataPath, "catalog", "workspace-sessions.json"),
      defaultValue: DEFAULT_DOCUMENT,
    });
  }

  list(): WorkspaceSession[] {
    return this.store.get().sessions;
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

    const nextState = this.store.update((state) => {
      const sessions = state.sessions.filter(
        (entry) => entry.worktreeId !== normalizedWorktreeId,
      );
      sessions.push(nextSession);

      return {
        ...state,
        sessions,
      };
    });

    return (
      nextState.sessions.find(
        (entry) => entry.worktreeId === normalizedWorktreeId,
      ) ?? nextSession
    );
  }

  replaceAll(sessions: WorkspaceSession[]): WorkspaceSession[] {
    const normalizedSessions = sessions.flatMap((session) => {
      const sanitized = sanitizeWorkspaceSession(session);
      return sanitized ? [sanitized] : [];
    });

    return this.store.set({
      version: 1,
      sessions: normalizedSessions,
    }).sessions;
  }
}
