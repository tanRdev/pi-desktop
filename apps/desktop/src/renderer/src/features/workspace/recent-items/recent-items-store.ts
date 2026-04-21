export interface RecentItem {
  readonly id: string;
  readonly label: string;
  readonly meta?: Record<string, unknown>;
  readonly accessedAt: number;
}

export type RecentFile = RecentItem & { readonly path: string };
export type RecentWorkspace = RecentItem & { readonly rootPath: string };
export type RecentThread = RecentItem & { readonly threadId: string };

export type RecentCategory = "files" | "workspaces" | "threads";

export type CategoryItemMap = {
  files: RecentFile;
  workspaces: RecentWorkspace;
  threads: RecentThread;
};

export interface CategoryList {
  readonly pinned: RecentItem[];
  readonly recent: RecentItem[];
}

export const DEFAULT_MAX_ITEMS = 100;

const STORAGE_KEY = "pi-desktop:recent-items";

interface PersistedItem {
  id: string;
  label: string;
  meta?: Record<string, unknown>;
  accessedAt: number;
  pinned?: boolean;
  path?: string;
  rootPath?: string;
  threadId?: string;
}

interface PersistedData {
  files: PersistedItem[];
  workspaces: PersistedItem[];
  threads: PersistedItem[];
}

function isPersistedData(value: unknown): value is PersistedData {
  if (value === null || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return (
    Array.isArray(rec.files) &&
    Array.isArray(rec.workspaces) &&
    Array.isArray(rec.threads)
  );
}

function hasUsableStorage(storage: Storage | undefined): storage is Storage {
  return (
    typeof storage?.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function"
  );
}

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && hasUsableStorage(window.localStorage)) {
    return window.localStorage;
  }
  return hasUsableStorage(globalThis.localStorage)
    ? globalThis.localStorage
    : null;
}

function extractPath(item: RecentItem): string | undefined {
  if ("path" in item) {
    const v = (item as Record<string, unknown>).path;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function extractRootPath(item: RecentItem): string | undefined {
  if ("rootPath" in item) {
    const v = (item as Record<string, unknown>).rootPath;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function extractThreadId(item: RecentItem): string | undefined {
  if ("threadId" in item) {
    const v = (item as Record<string, unknown>).threadId;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function itemToPersisted(item: RecentItem, pinned: boolean): PersistedItem {
  const base: PersistedItem = {
    id: item.id,
    label: item.label,
    accessedAt: item.accessedAt,
    pinned,
  };
  const path = extractPath(item);
  const rootPath = extractRootPath(item);
  const threadId = extractThreadId(item);
  if (path !== undefined) base.path = path;
  if (rootPath !== undefined) base.rootPath = rootPath;
  if (threadId !== undefined) base.threadId = threadId;
  if (item.meta !== undefined) base.meta = item.meta;
  return base;
}

function persistedToItem(pi: PersistedItem): RecentItem {
  const hasPath = typeof pi.path === "string";
  const hasRootPath = typeof pi.rootPath === "string";
  const hasThreadId = typeof pi.threadId === "string";

  if (hasPath && !hasRootPath && !hasThreadId) {
    const result: RecentFile = {
      id: pi.id,
      label: pi.label,
      accessedAt: pi.accessedAt,
      path: pi.path ?? "",
      ...(pi.meta !== undefined ? { meta: pi.meta } : {}),
    };
    return result;
  }
  if (!hasPath && hasRootPath && !hasThreadId) {
    const result: RecentWorkspace = {
      id: pi.id,
      label: pi.label,
      accessedAt: pi.accessedAt,
      rootPath: pi.rootPath ?? "",
      ...(pi.meta !== undefined ? { meta: pi.meta } : {}),
    };
    return result;
  }
  if (!hasPath && !hasRootPath && hasThreadId) {
    const result: RecentThread = {
      id: pi.id,
      label: pi.label,
      accessedAt: pi.accessedAt,
      threadId: pi.threadId ?? "",
      ...(pi.meta !== undefined ? { meta: pi.meta } : {}),
    };
    return result;
  }

  const result: RecentItem = {
    id: pi.id,
    label: pi.label,
    accessedAt: pi.accessedAt,
    ...(pi.meta !== undefined ? { meta: pi.meta } : {}),
  };
  return result;
}

export interface RecentItemsStore {
  readonly add: (category: RecentCategory, item: RecentItem) => void;
  readonly remove: (category: RecentCategory, id: string) => void;
  readonly pin: (category: RecentCategory, id: string) => void;
  readonly unpin: (category: RecentCategory, id: string) => void;
  readonly clearAll: (category: RecentCategory) => void;
  readonly list: (category: RecentCategory) => CategoryList;
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => PersistedData;
}

function emptyData(): PersistedData {
  return { files: [], workspaces: [], threads: [] };
}

export function createRecentItemsStore(
  storage?: Storage | null,
  maxItems: number = DEFAULT_MAX_ITEMS,
): RecentItemsStore {
  const listeners = new Set<() => void>();
  let data: PersistedData;

  const resolvedStorage = storage === undefined ? getStorage() : storage;

  try {
    if (resolvedStorage) {
      const raw = resolvedStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        data = isPersistedData(parsed) ? parsed : emptyData();
      } else {
        data = emptyData();
      }
    } else {
      data = emptyData();
    }
  } catch {
    data = emptyData();
  }

  const listCache = new Map<RecentCategory, CategoryList>();
  let listCacheDirty = true;

  function persist(): void {
    if (!resolvedStorage) return;
    try {
      resolvedStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota or other storage errors silently degrade
    }
  }

  function notify(): void {
    listCacheDirty = true;
    for (const l of listeners) l();
  }

  function getCategory(category: RecentCategory): PersistedItem[] {
    return data[category];
  }

  function computeList(category: RecentCategory): CategoryList {
    if (!listCacheDirty) {
      const cached = listCache.get(category);
      if (cached) return cached;
    }
    const items = getCategory(category);
    const pinned: RecentItem[] = [];
    const recent: RecentItem[] = [];
    for (const pi of items) {
      const item = persistedToItem(pi);
      if (pi.pinned) {
        pinned.push(item);
      } else {
        recent.push(item);
      }
    }
    const result: CategoryList = { pinned, recent };
    listCacheDirty = false;
    listCache.set(category, result);
    return result;
  }

  return {
    add(category: RecentCategory, item: RecentItem): void {
      const items = getCategory(category);
      const withoutExisting = items.filter((i) => i.id !== item.id);
      const existing = items.find((i) => i.id === item.id);
      const wasPinned = existing?.pinned === true;
      withoutExisting.unshift(itemToPersisted(item, wasPinned));
      if (withoutExisting.length > maxItems) {
        withoutExisting.splice(maxItems);
      }
      data = { ...data, [category]: withoutExisting };
      persist();
      notify();
    },

    remove(category: RecentCategory, id: string): void {
      const items = getCategory(category).filter((i) => i.id !== id);
      data = { ...data, [category]: items };
      persist();
      notify();
    },

    pin(category: RecentCategory, id: string): void {
      const items = getCategory(category);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1 || items[idx]?.pinned) return;
      const updated = [...items];
      updated[idx] = { ...updated[idx]!, pinned: true };
      data = { ...data, [category]: updated };
      persist();
      notify();
    },

    unpin(category: RecentCategory, id: string): void {
      const items = getCategory(category);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1 || !items[idx]?.pinned) return;
      const updated = [...items];
      updated[idx] = { ...updated[idx]!, pinned: false };
      data = { ...data, [category]: updated };
      persist();
      notify();
    },

    clearAll(category: RecentCategory): void {
      if (data[category].length === 0) return;
      data = { ...data, [category]: [] };
      persist();
      notify();
    },

    list(category: RecentCategory): CategoryList {
      return computeList(category);
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    snapshot(): PersistedData {
      return data;
    },
  };
}

export const globalRecentItemsStore: RecentItemsStore =
  createRecentItemsStore();
