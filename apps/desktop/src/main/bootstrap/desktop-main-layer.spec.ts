import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  GitCapability as GitCapabilityTag,
  RepositoryCatalog as RepositoryCatalogTag,
  TerminalManager as TerminalManagerTag,
} from "../effect/services";
import { SessionCapability } from "../session/session-capability";
import { createDesktopMainLayer } from "./desktop-main-layer";

function createStubSession() {
  return {
    getContext: () => null,
    getHost: () => ({
      getProviders: async () => [],
      getSettings: async () => ({}),
      getSnapshot: async () => ({
        sessionId: "stub",
        status: "ready" as const,
        messages: [],
        lastError: null,
      }),
      prompt: async () => undefined,
      cancelPrompt: async () => undefined,
      reset: async () => undefined,
      subscribe: () => () => {},
    }),
    getTransport: () => null,
    getUnsubscribe: () => () => {},
    commitAttachment: vi.fn(),
    replaceHost: vi.fn(),
    clearSession: vi.fn(),
    switchContext: vi.fn(async () => undefined),
    dispose: vi.fn(),
  };
}

describe("createDesktopMainLayer", () => {
  it("provides catalog, git, terminal, and session capabilities together", async () => {
    const repositoryCatalog = {
      list: () => [],
      get: () => null,
      upsert: vi.fn(),
      remove: vi.fn(),
      setLastSelectedWorktree: vi.fn(),
      reorder: vi.fn(),
    };
    const gitService = {
      inspect: vi.fn(),
      inspectAsync: vi.fn(),
      isRepository: vi.fn(() => true),
      init: vi.fn(),
      createWorktree: vi.fn(),
      removeWorktree: vi.fn(),
      getRepositoryStatus: vi.fn(),
      stageFile: vi.fn(),
      stageFiles: vi.fn(),
      unstageFile: vi.fn(),
      unstageFiles: vi.fn(),
      discardTrackedFile: vi.fn(),
      commit: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
      fetch: vi.fn(),
      getFileDiff: vi.fn(),
    };
    const terminalManager = {
      create: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
      destroyAsync: vi.fn(async () => undefined),
      destroyAll: vi.fn(),
      destroyAllAsync: vi.fn(async () => undefined),
      get: vi.fn(),
      getSessions: vi.fn(() => []),
      isAvailable: vi.fn(() => false),
      initialize: vi.fn(),
      setMainWindow: vi.fn(),
      isOwnedBy: vi.fn(() => false),
    };
    const sessionCapability = createStubSession();

    const layer = createDesktopMainLayer({
      repositoryCatalog: repositoryCatalog as never,
      gitService: gitService as never,
      terminalManager: terminalManager as never,
      sessionCapability: sessionCapability as never,
    });

    const program = Effect.gen(function* () {
      const catalog = yield* RepositoryCatalogTag;
      const git = yield* GitCapabilityTag;
      const terminal = yield* TerminalManagerTag;
      const session = yield* SessionCapability;
      const listed = yield* catalog.list;
      const isRepo = yield* git.isRepository("/tmp/repo");
      return {
        listed,
        isRepo,
        terminalAvailable: yield* terminal.isAvailable,
        context: session.getContext(),
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(layer)) as Effect.Effect<
        {
          listed: unknown[];
          isRepo: boolean;
          terminalAvailable: boolean;
          context: null;
        },
        never,
        never
      >,
    );

    expect(result).toEqual({
      listed: [],
      isRepo: true,
      terminalAvailable: false,
      context: null,
    });
  });
});
