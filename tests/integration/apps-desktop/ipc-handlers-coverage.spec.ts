import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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

async function loadContractError() {
  const { ContractError } = await import(
    "../../../packages/contracts/src/contract-runtime"
  );
  return ContractError;
}

describe("terminal handlers - session ID validation", () => {
  it("terminal handlers reject invalid payloads at the contract seam", async () => {
    const ContractError = await loadContractError();
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
    await expect(
      writeHandler({}, { id: 123, data: "hi" }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(writeHandler({}, { data: "hi" })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(
      writeHandler({}, { id: 123, data: "hi" }),
    ).rejects.toBeInstanceOf(ContractError);

    const resizeHandler = handlers.get("terminal:resize");
    if (!resizeHandler)
      throw new Error("terminal:resize handler not registered");
    await expect(
      resizeHandler({}, { id: true, cols: 80, rows: 24 }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(
      resizeHandler({}, { id: true, cols: 80, rows: 24 }),
    ).rejects.toBeInstanceOf(ContractError);

    const destroyHandler = handlers.get("terminal:destroy");
    if (!destroyHandler)
      throw new Error("terminal:destroy handler not registered");
    await expect(destroyHandler({}, { id: null })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(destroyHandler({}, { id: null })).rejects.toBeInstanceOf(
      ContractError,
    );
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

  it("repository handlers reject payloads with non-string repositoryId", async () => {
    const ContractError = await loadContractError();
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
    await expect(selectHandler({}, { repositoryId: 42 })).rejects.toMatchObject(
      { code: "contract/encode-failed" },
    );
    await expect(
      selectHandler({}, { repositoryId: 42 }),
    ).rejects.toBeInstanceOf(ContractError);

    const removeHandler = handlers.get("repositories:remove");
    if (!removeHandler)
      throw new Error("repositories:remove handler not registered");
    await expect(
      removeHandler({}, { repositoryId: true }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });

    const openHandler = handlers.get("repositories:openInFinder");
    if (!openHandler)
      throw new Error("repositories:openInFinder handler not registered");
    await expect(openHandler({}, { repositoryId: null })).rejects.toMatchObject(
      { code: "contract/encode-failed" },
    );
  });

  it("worktree handlers reject payloads with non-string IDs", async () => {
    const ContractError = await loadContractError();
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
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(
      createHandler({}, { repositoryId: "r1", branchName: 456 }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(
      createHandler({}, { repositoryId: 123, branchName: "feat" }),
    ).rejects.toBeInstanceOf(ContractError);

    const selectWtHandler = handlers.get("worktrees:select");
    if (!selectWtHandler)
      throw new Error("worktrees:select handler not registered");
    await expect(selectWtHandler({}, { worktreeId: [] })).rejects.toMatchObject(
      { code: "contract/encode-failed" },
    );

    const removeWtHandler = handlers.get("worktrees:remove");
    if (!removeWtHandler)
      throw new Error("worktrees:remove handler not registered");
    await expect(removeWtHandler({}, { worktreeId: {} })).rejects.toMatchObject(
      { code: "contract/encode-failed" },
    );
  });
});

describe("state handlers - key validation", () => {
  it("state handlers reject payloads with non-string repositoryId", async () => {
    const ContractError = await loadContractError();
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
    await expect(
      getRepoHandler({}, { repositoryId: 123 }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(
      getRepoHandler({}, { repositoryId: null }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });
    await expect(getRepoHandler({}, {})).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(
      getRepoHandler({}, { repositoryId: 123 }),
    ).rejects.toBeInstanceOf(ContractError);

    const updateRepoHandler = handlers.get("state:updateRepositoryPreferences");
    if (!updateRepoHandler)
      throw new Error(
        "state:updateRepositoryPreferences handler not registered",
      );
    await expect(
      updateRepoHandler({}, { repositoryId: [] }),
    ).rejects.toMatchObject({ code: "contract/encode-failed" });

    const getWsHandler = handlers.get("state:getWorkspaceSession");
    if (!getWsHandler)
      throw new Error("state:getWorkspaceSession handler not registered");
    await expect(getWsHandler({}, { worktreeId: true })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(getWsHandler({}, {})).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
  });
});

describe("thread handlers - thread ID validation", () => {
  it("thread handlers reject payloads with non-string or empty threadId", async () => {
    const ContractError = await loadContractError();
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
    await expect(selectHandler({}, { threadId: 123 })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(selectHandler({}, { threadId: 123 })).rejects.toBeInstanceOf(
      ContractError,
    );

    const deleteHandler = handlers.get("threads:delete");
    if (!deleteHandler)
      throw new Error("threads:delete handler not registered");
    await expect(deleteHandler({}, { threadId: true })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(deleteHandler({}, { threadId: null })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(deleteHandler({}, {})).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
  });

  it("thread create rejects non-string worktreeId", async () => {
    const ContractError = await loadContractError();
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
    await expect(createHandler({}, { worktreeId: 999 })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(createHandler({}, { worktreeId: [] })).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(createHandler({}, {})).rejects.toMatchObject({
      code: "contract/encode-failed",
    });
    await expect(createHandler({}, { worktreeId: 999 })).rejects.toBeInstanceOf(
      ContractError,
    );
  });
});
