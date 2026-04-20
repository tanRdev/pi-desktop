import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_ARRAY_LENGTH,
  MAX_STRING_BYTES,
  PayloadValidationError,
  getBooleanField,
  getNumberField,
  getStringArrayField,
  getStringField,
  isPayloadRecord,
  parseTerminalCreateOptionsStrict,
  requireStringField,
} from "../../../apps/desktop/src/main/ipc/payload-parsers";
import {
  isPathWithinAny,
  resolveInsideRoot,
} from "../../../apps/desktop/src/main/fs/path-guards";

const TMP_PREFIX = path.join(os.tmpdir(), "pi-ipc-handlers-coverage-");
const tempDirs: string[] = [];

function makeTmpDir(label: string): string {
  const dir = mkdtempSync(`${TMP_PREFIX}${label}-`);
  const canonical = realpathSync(dir);
  tempDirs.push(dir);
  return canonical;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("terminal handlers - session ID validation", () => {
  it("getStringField returns undefined for non-string id", () => {
    expect(getStringField({ id: 123 }, "id")).toBeUndefined();
    expect(getStringField({ id: true }, "id")).toBeUndefined();
    expect(getStringField({ id: null }, "id")).toBeUndefined();
    expect(getStringField({ id: [] }, "id")).toBeUndefined();
    expect(getStringField({ id: {} }, "id")).toBeUndefined();
  });

  it("getStringField returns undefined for empty payload or non-object", () => {
    expect(getStringField(null, "id")).toBeUndefined();
    expect(getStringField(undefined, "id")).toBeUndefined();
    expect(getStringField("string", "id")).toBeUndefined();
    expect(getStringField(42, "id")).toBeUndefined();
  });

  it("requireStringField rejects non-string id with wrong-type code", () => {
    for (const bad of [123, true, null, [], {}]) {
      try {
        requireStringField({ id: bad }, "id");
        throw new Error("expected PayloadValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadValidationError);
        if (error instanceof PayloadValidationError) {
          expect(error.code).toBe("payload/wrong-type");
          expect(error.field).toBe("id");
        }
      }
    }
  });

  it("requireStringField rejects missing id with missing-field code", () => {
    try {
      requireStringField({}, "id");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/missing-field");
        expect(error.field).toBe("id");
      }
    }
  });

  it("requireStringField rejects oversized strings beyond MAX_STRING_BYTES", () => {
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    try {
      requireStringField({ id: giant }, "id");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
      }
    }
  });

  it("getStringField throws PayloadValidationError for oversized strings", () => {
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    expect(() => getStringField({ id: giant }, "id")).toThrow(
      PayloadValidationError,
    );
  });

  it("terminal handlers reject non-string session IDs via getStringField", async () => {
    const { registerTerminalHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-terminal-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();
    const allowedRoot = makeTmpDir("term");

    registerTerminalHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      mainWindow: null,
      terminalManager: {
        initialize: () => {},
        setMainWindow: () => {},
        isAvailable: () => true,
        getError: () => null,
        create: () => ({ id: "test" }),
        getSessions: () => [],
        write: () => {},
        resize: () => {},
        destroy: () => {},
        isOwnedBy: () => true,
      },
      getAllowedTerminalCwds: () => [allowedRoot],
    });

    const writeHandler = handlers.get("terminal:write");
    if (!writeHandler) throw new Error("terminal:write handler not registered");
    await expect(writeHandler({}, { id: 123, data: "hi" })).rejects.toThrow();
    await expect(writeHandler({}, { data: "hi" })).rejects.toThrow();

    const resizeHandler = handlers.get("terminal:resize");
    if (!resizeHandler)
      throw new Error("terminal:resize handler not registered");
    await expect(
      resizeHandler({}, { id: true, cols: 80, rows: 24 }),
    ).rejects.toThrow();

    const destroyHandler = handlers.get("terminal:destroy");
    if (!destroyHandler)
      throw new Error("terminal:destroy handler not registered");
    await expect(destroyHandler({}, { id: null })).rejects.toThrow();
  });
});

describe("repository handlers - path guard validation", () => {
  it("rejects repository add with traversal path via isPathWithinAny", () => {
    const allowedRoot = makeTmpDir("repo");
    expect(isPathWithinAny([allowedRoot], "../../../etc/passwd")).toBe(false);
    expect(isPathWithinAny([allowedRoot], "/etc/passwd")).toBe(false);
  });

  it("rejects repository add with traversal path via resolveInsideRoot", () => {
    const allowedRoot = makeTmpDir("repo2");
    expect(() =>
      resolveInsideRoot([allowedRoot], "../../../etc/passwd"),
    ).toThrow();
  });

  it("getStringField returns undefined for non-string path on repo add", () => {
    expect(getStringField({ path: 123 }, "path")).toBeUndefined();
    expect(getStringField({ path: true }, "path")).toBeUndefined();
    expect(getStringField({ path: null }, "path")).toBeUndefined();
    expect(getStringField({ path: [] }, "path")).toBeUndefined();
  });

  it("repository handlers reject payloads with non-string repositoryId", async () => {
    const { registerRepositoryHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-repository-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();

    registerRepositoryHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      agentHost: {
        addRepository: async () => {},
        selectRepository: async () => {},
        reorderRepositories: async () => {},
        removeRepository: async () => {},
        openRepositoryInFinder: async () => {},
        createWorktree: async () => {},
        selectWorktree: async () => {},
        removeWorktree: async () => {},
      },
    });

    const selectHandler = handlers.get("repositories:select");
    if (!selectHandler)
      throw new Error("repositories:select handler not registered");
    await expect(selectHandler({}, { repositoryId: 42 })).rejects.toThrow();

    const removeHandler = handlers.get("repositories:remove");
    if (!removeHandler)
      throw new Error("repositories:remove handler not registered");
    await expect(removeHandler({}, { repositoryId: true })).rejects.toThrow();

    const openHandler = handlers.get("repositories:openInFinder");
    if (!openHandler)
      throw new Error("repositories:openInFinder handler not registered");
    await expect(openHandler({}, { repositoryId: null })).rejects.toThrow();
  });

  it("worktree handlers reject payloads with non-string IDs", async () => {
    const { registerRepositoryHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-repository-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();

    registerRepositoryHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      agentHost: {
        addRepository: async () => {},
        selectRepository: async () => {},
        reorderRepositories: async () => {},
        removeRepository: async () => {},
        openRepositoryInFinder: async () => {},
        createWorktree: async () => {},
        selectWorktree: async () => {},
        removeWorktree: async () => {},
      },
    });

    const createHandler = handlers.get("worktrees:create");
    if (!createHandler)
      throw new Error("worktrees:create handler not registered");
    await expect(
      createHandler({}, { repositoryId: 123, branchName: "feat" }),
    ).rejects.toThrow();
    await expect(
      createHandler({}, { repositoryId: "r1", branchName: 456 }),
    ).rejects.toThrow();

    const selectWtHandler = handlers.get("worktrees:select");
    if (!selectWtHandler)
      throw new Error("worktrees:select handler not registered");
    await expect(selectWtHandler({}, { worktreeId: [] })).rejects.toThrow();

    const removeWtHandler = handlers.get("worktrees:remove");
    if (!removeWtHandler)
      throw new Error("worktrees:remove handler not registered");
    await expect(removeWtHandler({}, { worktreeId: {} })).rejects.toThrow();
  });

  it("getStringField throws for oversized path values", () => {
    const giant = "/".repeat(MAX_STRING_BYTES + 1);
    expect(() => getStringField({ path: giant }, "path")).toThrow(
      PayloadValidationError,
    );
  });
});

describe("state handlers - key validation", () => {
  it("getStringField reads __proto__ from parsed JSON (no special handling)", () => {
    const malicious = JSON.parse('{"__proto__": "polluted"}');
    expect(getStringField(malicious, "__proto__")).toBe("polluted");
    expect(getStringField(malicious, "constructor")).toBeUndefined();
    expect(getStringField(malicious, "prototype")).toBeUndefined();
  });

  it("isPayloadRecord accepts null-prototype objects", () => {
    const payload = Object.create(null);
    payload.constructor = "evil";
    expect(requireStringField(payload, "constructor")).toBe("evil");
  });

  it("isPayloadRecord rejects arrays so array-based injection is impossible", () => {
    try {
      requireStringField([1, 2, 3], "any");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/not-object");
      }
    }
  });

  it("requireStringField rejects oversized string exceeding MAX_STRING_BYTES", () => {
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    try {
      requireStringField({ repositoryId: giant }, "repositoryId");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
        expect(error.field).toBe("repositoryId");
      }
    }
  });

  it("state handlers reject payloads with non-string repositoryId", async () => {
    const { registerStateHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-state-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();

    const mockStateHost = {
      getRepositoryPreferences: async () => null,
      updateRepositoryPreferences: async () => ({}),
      getWorkspaceSession: async () => null,
      saveWorkspaceSession: async () => ({}),
      getAppPreferences: async () => ({}),
      updateAppPreferences: async () => ({}),
      importLegacyPreferences: async () => ({
        repositoryPreferences: [],
        appPreferences: {},
      }),
    };

    registerStateHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      stateHost: mockStateHost,
    });

    const getRepoHandler = handlers.get("state:getRepositoryPreferences");
    if (!getRepoHandler)
      throw new Error("state:getRepositoryPreferences handler not registered");
    await expect(getRepoHandler({}, { repositoryId: 123 })).rejects.toThrow();
    await expect(getRepoHandler({}, { repositoryId: null })).rejects.toThrow();
    await expect(getRepoHandler({}, {})).rejects.toThrow();

    const updateRepoHandler = handlers.get("state:updateRepositoryPreferences");
    if (!updateRepoHandler)
      throw new Error(
        "state:updateRepositoryPreferences handler not registered",
      );
    await expect(updateRepoHandler({}, { repositoryId: [] })).rejects.toThrow();

    const getWsHandler = handlers.get("state:getWorkspaceSession");
    if (!getWsHandler)
      throw new Error("state:getWorkspaceSession handler not registered");
    await expect(getWsHandler({}, { worktreeId: true })).rejects.toThrow();
    await expect(getWsHandler({}, {})).rejects.toThrow();
  });

  it("requireStringField rejects null, undefined, arrays, strings, numbers, booleans", () => {
    for (const bad of [null, undefined, [], "str", 42, true]) {
      try {
        requireStringField(bad, "anyKey");
        throw new Error("expected PayloadValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadValidationError);
        if (error instanceof PayloadValidationError) {
          expect(error.code).toBe("payload/not-object");
        }
      }
    }
  });
});

describe("thread handlers - thread ID validation", () => {
  it("getStringField returns undefined for non-string threadId", () => {
    expect(getStringField({ threadId: 123 }, "threadId")).toBeUndefined();
    expect(getStringField({ threadId: true }, "threadId")).toBeUndefined();
    expect(getStringField({ threadId: null }, "threadId")).toBeUndefined();
    expect(getStringField({ threadId: [] }, "threadId")).toBeUndefined();
    expect(getStringField({ threadId: {} }, "threadId")).toBeUndefined();
  });

  it("thread handlers reject payloads with non-string or empty threadId", async () => {
    const { registerThreadHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-thread-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();

    registerThreadHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      agentHost: {
        createThread: async () => ({ id: "t1", worktreeId: "w1" }),
        selectThread: async () => {},
        deleteThread: async () => {},
      },
    });

    const selectHandler = handlers.get("threads:select");
    if (!selectHandler)
      throw new Error("threads:select handler not registered");
    await expect(selectHandler({}, { threadId: 123 })).rejects.toThrow();

    const deleteHandler = handlers.get("threads:delete");
    if (!deleteHandler)
      throw new Error("threads:delete handler not registered");
    await expect(deleteHandler({}, { threadId: true })).rejects.toThrow();
    await expect(deleteHandler({}, { threadId: null })).rejects.toThrow();
    await expect(deleteHandler({}, {})).rejects.toThrow();
  });

  it("thread create rejects non-string worktreeId", async () => {
    const { registerThreadHandlers } = await import(
      "../../../apps/desktop/src/main/ipc/register-thread-handlers"
    );
    const handlers = new Map<
      string,
      (event: unknown, payload: unknown) => unknown
    >();

    registerThreadHandlers({
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      agentHost: {
        createThread: async () => ({ id: "t1", worktreeId: "w1" }),
        selectThread: async () => {},
        deleteThread: async () => {},
      },
    });

    const createHandler = handlers.get("threads:create");
    if (!createHandler)
      throw new Error("threads:create handler not registered");
    await expect(createHandler({}, { worktreeId: 999 })).rejects.toThrow();
    await expect(createHandler({}, { worktreeId: [] })).rejects.toThrow();
    await expect(createHandler({}, {})).rejects.toThrow();
  });

  it("requireStringField throws PayloadValidationError for oversized threadId", () => {
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    try {
      requireStringField({ threadId: giant }, "threadId");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
      }
    }
  });
});

describe("payload-parsers - cross-handler security invariants", () => {
  it("getBooleanField does not coerce truthy values", () => {
    expect(getBooleanField({ flag: 1 }, "flag")).toBeUndefined();
    expect(getBooleanField({ flag: "true" }, "flag")).toBeUndefined();
    expect(getBooleanField({ flag: 0 }, "flag")).toBeUndefined();
    expect(getBooleanField({ flag: "" }, "flag")).toBeUndefined();
    expect(getBooleanField({ flag: true }, "flag")).toBe(true);
    expect(getBooleanField({ flag: false }, "flag")).toBe(false);
  });

  it("getNumberField rejects NaN, Infinity, and non-number types", () => {
    expect(getNumberField({ x: Number.NaN }, "x")).toBeUndefined();
    expect(
      getNumberField({ x: Number.POSITIVE_INFINITY }, "x"),
    ).toBeUndefined();
    expect(
      getNumberField({ x: Number.NEGATIVE_INFINITY }, "x"),
    ).toBeUndefined();
    expect(getNumberField({ x: "42" }, "x")).toBeUndefined();
    expect(getNumberField({ x: true }, "x")).toBeUndefined();
    expect(getNumberField({ x: null }, "x")).toBeUndefined();
    expect(getNumberField({ x: 0 }, "x")).toBe(0);
    expect(getNumberField({ x: -1 }, "x")).toBe(-1);
  });

  it("parseTerminalCreateOptionsStrict rejects unknown keys", () => {
    try {
      parseTerminalCreateOptionsStrict({
        id: "t1",
        cols: 80,
        rows: 24,
        ownerWindowId: "w1",
        evil: "injection",
      });
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/unknown-keys");
      }
    }
  });

  it("parseTerminalCreateOptionsStrict requires all mandatory fields", () => {
    const required = ["id", "ownerWindowId"];
    for (const missing of required) {
      const base = {
        id: "t1",
        cols: 80,
        rows: 24,
        ownerWindowId: "w1",
      };
      const payload = { ...base, [missing]: undefined };
      try {
        parseTerminalCreateOptionsStrict(payload);
        throw new Error("expected PayloadValidationError");
      } catch (error) {
        expect(error).toBeInstanceOf(PayloadValidationError);
      }
    }
  });

  it("getStringArrayField filters non-string entries", () => {
    const mixed = ["ok", 123, true, null, "also-ok", [], {}];
    const result = getStringArrayField({ items: mixed }, "items");
    expect(result).toEqual(["ok", "also-ok"]);
  });

  it("getStringArrayField caps array at MAX_ARRAY_LENGTH", () => {
    const huge: string[] = [];
    huge.length = MAX_ARRAY_LENGTH + 1;
    huge.fill("x");
    try {
      getStringArrayField({ items: huge }, "items");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/array-too-large");
      }
    }
  });

  it("getStringArrayField caps individual string entries at MAX_STRING_BYTES", () => {
    const giant = "x".repeat(MAX_STRING_BYTES + 1);
    try {
      getStringArrayField({ items: [giant] }, "items");
      throw new Error("expected PayloadValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadValidationError);
      if (error instanceof PayloadValidationError) {
        expect(error.code).toBe("payload/string-too-large");
      }
    }
  });
});
