function hasUsableStorage(storage: Storage | undefined): storage is Storage {
  return (
    typeof storage?.getItem === "function" &&
    typeof storage.setItem === "function" &&
    typeof storage.removeItem === "function" &&
    typeof storage.clear === "function"
  );
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  } satisfies Storage;
}

// Provide a minimal in-memory localStorage when running in a test/node
// environment where the DOM's localStorage is missing or partially stubbed.
if (!hasUsableStorage(globalThis.localStorage)) {
  Object.defineProperty(globalThis, "localStorage", {
    value: createMemoryStorage(),
    configurable: true,
  });
}

const LEFT_SIDEBAR_KEY = "pi-desktop.leftSidebarWidth";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 140;
const MAX_WIDTH = 400;

export const DEFAULT_LEFT_SIDEBAR_WIDTH = DEFAULT_WIDTH;

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && hasUsableStorage(window.localStorage)) {
    return window.localStorage;
  }

  return hasUsableStorage(globalThis.localStorage)
    ? globalThis.localStorage
    : null;
}

export function clampLeftSidebarWidth(width: number): number {
  if (typeof width !== "number" || Number.isNaN(width)) return DEFAULT_WIDTH;
  if (width === 0) return 0;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.floor(width)));
}

export function readLegacyLeftSidebarWidth(): number | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(LEFT_SIDEBAR_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return null;
    return clampLeftSidebarWidth(parsed);
  } catch {
    return null;
  }
}
