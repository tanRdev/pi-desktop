import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageLike } from "@/features/snapshots/snapshot-store";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_WORKSPACE_PREFS,
  deleteWorkspacePrefs,
  getWorkspacePrefs,
  KEY_PREFIX,
  listWorkspacePrefIds,
  normalizeWorkspacePrefs,
  setWorkspacePref,
  type WorkspacePrefs,
} from "./workspace-prefs";

function createMemoryStorage(): StorageLike & {
  dump: () => Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    key(index) {
      const keys = Array.from(data.keys());
      return keys[index] ?? null;
    },
    dump: () => data,
  };
}

describe("workspace-prefs", () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getWorkspacePrefs", () => {
    it("returns defaults for a worktree with no stored prefs", () => {
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("reads stored prefs correctly", () => {
      const stored: WorkspacePrefs = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        sidebarWidth: 300,
        activePanel: "files",
        layout: "compact",
        customShortcuts: { "cmd-p": "open-file" },
      };
      storage.setItem(`${KEY_PREFIX}wt-1`, JSON.stringify(stored));
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs).toEqual(stored);
    });

    it("returns defaults when localStorage is unavailable", () => {
      const prefs = getWorkspacePrefs("wt-1");
      expect(prefs).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("recovers from invalid JSON by returning defaults", () => {
      storage.setItem(`${KEY_PREFIX}wt-1`, "not-json{{{");
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("normalizes partially corrupt data — keeps valid fields, drops invalid", () => {
      storage.setItem(
        `${KEY_PREFIX}wt-1`,
        JSON.stringify({
          schemaVersion: 2,
          sidebarWidth: "not-a-number",
          activePanel: 42,
          layout: "compact",
          customShortcuts: "not-an-object",
        }),
      );
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.schemaVersion).toBe(2);
      expect(prefs.sidebarWidth).toBeUndefined();
      expect(prefs.activePanel).toBeUndefined();
      expect(prefs.layout).toBe("compact");
      expect(prefs.customShortcuts).toBeUndefined();
    });
  });

  describe("setWorkspacePref", () => {
    it("sets a single pref and preserves existing ones", () => {
      setWorkspacePref("wt-1", "sidebarWidth", 250, storage);
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.sidebarWidth).toBe(250);

      setWorkspacePref("wt-1", "activePanel", "notes", storage);
      const prefs2 = getWorkspacePrefs("wt-1", storage);
      expect(prefs2.sidebarWidth).toBe(250);
      expect(prefs2.activePanel).toBe("notes");
    });

    it("sets layout pref", () => {
      setWorkspacePref("wt-1", "layout", "wide", storage);
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.layout).toBe("wide");
    });

    it("sets customShortcuts pref", () => {
      setWorkspacePref(
        "wt-1",
        "customShortcuts",
        { "cmd-k": "search" },
        storage,
      );
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.customShortcuts).toEqual({ "cmd-k": "search" });
    });

    it("no-ops when storage is unavailable", () => {
      expect(() => setWorkspacePref("wt-1", "sidebarWidth", 200)).not.toThrow();
    });
  });

  describe("deleteWorkspacePrefs", () => {
    it("removes stored prefs for a worktree", () => {
      setWorkspacePref("wt-1", "sidebarWidth", 200, storage);
      expect(getWorkspacePrefs("wt-1", storage).sidebarWidth).toBe(200);

      deleteWorkspacePrefs("wt-1", storage);
      expect(getWorkspacePrefs("wt-1", storage)).toEqual(
        DEFAULT_WORKSPACE_PREFS,
      );
    });

    it("does not affect other worktree prefs", () => {
      setWorkspacePref("wt-1", "sidebarWidth", 200, storage);
      setWorkspacePref("wt-2", "sidebarWidth", 400, storage);

      deleteWorkspacePrefs("wt-1", storage);
      expect(getWorkspacePrefs("wt-2", storage).sidebarWidth).toBe(400);
    });

    it("no-ops when storage is unavailable", () => {
      expect(() => deleteWorkspacePrefs("wt-1")).not.toThrow();
    });
  });

  describe("listWorkspacePrefIds", () => {
    it("returns empty array when no prefs stored", () => {
      expect(listWorkspacePrefIds(storage)).toEqual([]);
    });

    it("lists worktree IDs with stored prefs", () => {
      setWorkspacePref("wt-alpha", "sidebarWidth", 200, storage);
      setWorkspacePref("wt-beta", "layout", "compact", storage);
      const ids = listWorkspacePrefIds(storage);
      expect(ids.sort()).toEqual(["wt-alpha", "wt-beta"]);
    });

    it("does not list keys from other prefixes", () => {
      storage.setItem("pi-desktop:other-thing:wt-1", "{}");
      setWorkspacePref("wt-1", "sidebarWidth", 200, storage);
      const ids = listWorkspacePrefIds(storage);
      expect(ids).toEqual(["wt-1"]);
    });

    it("returns empty when storage is unavailable", () => {
      expect(listWorkspacePrefIds()).toEqual([]);
    });
  });

  describe("migration", () => {
    it("migrates v1 to v2 by adding schemaVersion and preserving valid fields", () => {
      storage.setItem(
        `${KEY_PREFIX}wt-1`,
        JSON.stringify({
          schemaVersion: 1,
          sidebarWidth: 280,
          activePanel: "files",
          customShortcuts: { "ctrl-s": "save" },
        }),
      );
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.schemaVersion).toBe(2);
      expect(prefs.sidebarWidth).toBe(280);
      expect(prefs.activePanel).toBe("files");
      expect(prefs.layout).toBeUndefined();
      expect(prefs.customShortcuts).toEqual({ "ctrl-s": "save" });
    });

    it("falls back to defaults for a schema version newer than current", () => {
      storage.setItem(
        `${KEY_PREFIX}wt-1`,
        JSON.stringify({
          schemaVersion: 999,
          sidebarWidth: 500,
        }),
      );
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("normalizes a v1 record with missing schemaVersion (treated as v1)", () => {
      storage.setItem(
        `${KEY_PREFIX}wt-1`,
        JSON.stringify({
          sidebarWidth: 260,
          activePanel: "search",
        }),
      );
      const prefs = getWorkspacePrefs("wt-1", storage);
      expect(prefs.schemaVersion).toBe(2);
      expect(prefs.sidebarWidth).toBe(260);
      expect(prefs.activePanel).toBe("search");
    });
  });

  describe("normalizeWorkspacePrefs", () => {
    it("returns defaults for null input", () => {
      expect(normalizeWorkspacePrefs(null)).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("returns defaults for non-object input", () => {
      expect(normalizeWorkspacePrefs("hello")).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("returns defaults for array input", () => {
      expect(normalizeWorkspacePrefs([])).toEqual(DEFAULT_WORKSPACE_PREFS);
    });

    it("keeps valid layout values and drops invalid ones", () => {
      const result = normalizeWorkspacePrefs({
        schemaVersion: 2,
        layout: "compact",
      });
      expect(result.layout).toBe("compact");

      const result2 = normalizeWorkspacePrefs({
        schemaVersion: 2,
        layout: "invalid-layout",
      });
      expect(result2.layout).toBeUndefined();
    });

    it("keeps valid customShortcuts and drops non-string values", () => {
      const result = normalizeWorkspacePrefs({
        schemaVersion: 2,
        customShortcuts: { a: "ok", b: 123, c: true },
      });
      expect(result.customShortcuts).toEqual({ a: "ok" });
    });

    it("drops customShortcuts when empty after filtering", () => {
      const result = normalizeWorkspacePrefs({
        schemaVersion: 2,
        customShortcuts: { a: 123, b: true },
      });
      expect(result.customShortcuts).toBeUndefined();
    });
  });
});
