import { describe, expect, it, vi } from "vitest";
import type { RecentFile, RecentItem } from "./recent-items-store";
import { createRecentItemsStore } from "./recent-items-store";

function makeFile(id: string, label: string, path: string): RecentFile {
  return { id, label, path, accessedAt: Date.now() };
}

function makeItem(id: string, label: string): RecentItem {
  return { id, label, accessedAt: Date.now() };
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
      store.set(key, value);
    },
  } satisfies Storage;
}

describe("recent-items-store", () => {
  it("starts with empty lists", () => {
    const store = createRecentItemsStore(null);
    const list = store.list("files");
    expect(list.pinned).toEqual([]);
    expect(list.recent).toEqual([]);
  });

  describe("add", () => {
    it("adds an item to the front of the recent list", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.add("files", makeFile("b", "file-b", "/b"));
      const list = store.list("files");
      expect(list.recent.map((i) => i.id)).toEqual(["b", "a"]);
    });

    it("deduplicates by id, moving existing item to front", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.add("files", makeFile("b", "file-b", "/b"));
      store.add("files", makeFile("a", "file-a-updated", "/a"));
      const list = store.list("files");
      expect(list.recent).toHaveLength(2);
      expect(list.recent[0]?.id).toBe("a");
      expect(list.recent[0]?.label).toBe("file-a-updated");
    });

    it("preserves pinned status on dedup re-add", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.pin("files", "a");
      store.add("files", makeFile("a", "file-a-v2", "/a"));
      const list = store.list("files");
      expect(list.pinned).toHaveLength(1);
      expect(list.pinned[0]?.label).toBe("file-a-v2");
    });
  });

  describe("max cap", () => {
    it("caps at 20 items per category", () => {
      const store = createRecentItemsStore(null);
      for (let i = 0; i < 25; i++) {
        store.add("files", makeFile(`id-${i}`, `file-${i}`, `/${i}`));
      }
      const list = store.list("files");
      const total = list.pinned.length + list.recent.length;
      expect(total).toBeLessThanOrEqual(100);
    });

    it("keeps the most recent items up to maxItems", () => {
      const store = createRecentItemsStore(null, 20);
      for (let i = 0; i < 25; i++) {
        store.add("files", makeFile(`id-${i}`, `file-${i}`, `/${i}`));
      }
      const list = store.list("files");
      const ids = [...list.pinned, ...list.recent].map((i) => i.id);
      expect(ids).toContain("id-24");
      expect(ids).toContain("id-5");
      expect(ids).not.toContain("id-4");
      expect(ids).not.toContain("id-0");
    });
  });

  describe("remove", () => {
    it("removes an item by id", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.add("files", makeFile("b", "file-b", "/b"));
      store.remove("files", "a");
      const list = store.list("files");
      expect(list.recent.map((i) => i.id)).toEqual(["b"]);
    });

    it("removes a pinned item", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.pin("files", "a");
      store.remove("files", "a");
      const list = store.list("files");
      expect(list.pinned).toEqual([]);
      expect(list.recent).toEqual([]);
    });

    it("is a no-op for nonexistent id", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.remove("files", "nonexistent");
      const list = store.list("files");
      expect(list.recent).toHaveLength(1);
    });
  });

  describe("pin / unpin", () => {
    it("moves an item from recent to pinned", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.pin("files", "a");
      const list = store.list("files");
      expect(list.pinned).toHaveLength(1);
      expect(list.pinned[0]?.id).toBe("a");
      expect(list.recent).toHaveLength(0);
    });

    it("pinned items always show first", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.add("files", makeFile("b", "file-b", "/b"));
      store.add("files", makeFile("c", "file-c", "/c"));
      store.pin("files", "b");
      const list = store.list("files");
      expect(list.pinned.map((i) => i.id)).toEqual(["b"]);
      expect(list.recent.map((i) => i.id)).toEqual(["c", "a"]);
    });

    it("unpin moves an item back to recent", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.pin("files", "a");
      store.unpin("files", "a");
      const list = store.list("files");
      expect(list.pinned).toHaveLength(0);
      expect(list.recent).toHaveLength(1);
      expect(list.recent[0]?.id).toBe("a");
    });

    it("pin is idempotent", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.pin("files", "a");
      store.pin("files", "a");
      const list = store.list("files");
      expect(list.pinned).toHaveLength(1);
    });

    it("unpin is idempotent for unpinned items", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      store.unpin("files", "a");
      const list = store.list("files");
      expect(list.recent).toHaveLength(1);
    });

    it("pin nonexistent id is a no-op", () => {
      const store = createRecentItemsStore(null);
      store.pin("files", "nonexistent");
      const list = store.list("files");
      expect(list.pinned).toEqual([]);
      expect(list.recent).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("persists to localStorage on every mutation", () => {
      const storage = createMemoryStorage();
      const store = createRecentItemsStore(storage);
      store.add("files", makeFile("a", "file-a", "/a"));
      const raw = storage.getItem("pi-desktop:recent-items");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0].id).toBe("a");
    });

    it("loads from localStorage on creation", () => {
      const storage = createMemoryStorage();
      storage.setItem(
        "pi-desktop:recent-items",
        JSON.stringify({
          files: [
            {
              id: "existing",
              label: "existing-file",
              accessedAt: 123,
              path: "/existing",
            },
          ],
          workspaces: [],
          threads: [],
        }),
      );
      const store = createRecentItemsStore(storage);
      const list = store.list("files");
      expect(list.recent).toHaveLength(1);
      expect(list.recent[0]?.id).toBe("existing");
    });

    it("gracefully handles corrupted localStorage data", () => {
      const storage = createMemoryStorage();
      storage.setItem("pi-desktop:recent-items", "not-json");
      const store = createRecentItemsStore(storage);
      const list = store.list("files");
      expect(list.pinned).toEqual([]);
      expect(list.recent).toEqual([]);
    });

    it("works without storage (null)", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeFile("a", "file-a", "/a"));
      const list = store.list("files");
      expect(list.recent).toHaveLength(1);
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers on add", () => {
      const store = createRecentItemsStore(null);
      const listener = vi.fn();
      store.subscribe(listener);
      store.add("files", makeItem("a", "a"));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers on remove", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeItem("a", "a"));
      const listener = vi.fn();
      store.subscribe(listener);
      store.remove("files", "a");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers on pin", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeItem("a", "a"));
      const listener = vi.fn();
      store.subscribe(listener);
      store.pin("files", "a");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers on unpin", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeItem("a", "a"));
      store.pin("files", "a");
      const listener = vi.fn();
      store.subscribe(listener);
      store.unpin("files", "a");
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes correctly", () => {
      const store = createRecentItemsStore(null);
      const listener = vi.fn();
      const unsub = store.subscribe(listener);
      unsub();
      store.add("files", makeItem("a", "a"));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("categories are independent", () => {
    it("files, workspaces, and threads do not interfere", () => {
      const store = createRecentItemsStore(null);
      store.add("files", makeItem("f1", "file-1"));
      store.add("workspaces", makeItem("w1", "workspace-1"));
      store.add("threads", makeItem("t1", "thread-1"));

      expect(store.list("files").recent).toHaveLength(1);
      expect(store.list("workspaces").recent).toHaveLength(1);
      expect(store.list("threads").recent).toHaveLength(1);

      store.remove("files", "f1");
      expect(store.list("files").recent).toHaveLength(0);
      expect(store.list("workspaces").recent).toHaveLength(1);
    });
  });
});
