import type {
  LinkColor,
  SearchResult,
  WindowState,
  WorkspaceWindow,
} from "@pi-desktop/shared";

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

function isWindowState(value: string): value is WindowState {
  return value === "normal" || value === "minimized" || value === "maximized";
}

function isLinkColor(value: string): value is LinkColor {
  return (
    value === "blue" ||
    value === "green" ||
    value === "orange" ||
    value === "pink" ||
    value === "purple" ||
    value === "yellow"
  );
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
    !state ||
    !isWindowState(state)
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
    ...(linkColor && isLinkColor(linkColor) ? { linkColor } : {}),
    ...(linkTargetIds ? { linkTargetIds } : {}),
  };
}

export function sanitizeWorkspaceWindow(
  input: unknown,
): WorkspaceWindow | null {
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
            const type =
              entry.type === "file" || entry.type === "directory"
                ? entry.type
                : undefined;
            if (
              !pathValue ||
              !name ||
              score === undefined ||
              type === undefined
            ) {
              return [];
            }
            const sanitizedResult: SearchResult = {
              path: pathValue,
              name,
              score,
              type,
              ...(getString(entry.extension)
                ? { extension: getString(entry.extension) }
                : {}),
            };
            return [sanitizedResult];
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
