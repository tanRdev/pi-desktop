type StorageHost = typeof globalThis & {
  localStorage?: Storage;
};

const storageHost = globalThis as StorageHost;

// Provide a minimal in-memory localStorage when running in a test/node
// environment where the DOM's localStorage is not available. This keeps
// behavior deterministic for unit tests that access `localStorage`.
if (typeof storageHost.localStorage === "undefined") {
  const _store = new Map<string, string>();
  storageHost.localStorage = {
    getItem(key: string) {
      return _store.has(key) ? (_store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      _store.set(String(key), String(value));
    },
    removeItem(key: string) {
      _store.delete(key);
    },
    clear() {
      _store.clear();
    },
  } as Storage;
}

const LEFT_SIDEBAR_KEY = "pidesk.leftSidebarWidth";
const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 140;
const MAX_WIDTH = 400;

function getStorage(): Storage | null {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }

  return storageHost.localStorage ?? null;
}

export function clampLeftSidebarWidth(width: number): number {
  if (typeof width !== "number" || Number.isNaN(width)) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width)));
}

export function loadLeftSidebarWidth(): number {
  try {
    const storage = getStorage();
    if (!storage) return DEFAULT_WIDTH;
    const raw = storage.getItem(LEFT_SIDEBAR_KEY);
    if (!raw) return DEFAULT_WIDTH;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return DEFAULT_WIDTH;
    return clampLeftSidebarWidth(parsed);
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function saveLeftSidebarWidth(width: number): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    const value = clampLeftSidebarWidth(width);
    storage.setItem(LEFT_SIDEBAR_KEY, String(value));
  } catch {
    // ignore write failures
  }
}
