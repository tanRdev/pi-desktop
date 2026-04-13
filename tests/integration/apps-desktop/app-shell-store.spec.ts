import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
} from "../../../apps/desktop/src/renderer/src/components/settings/defaults";
import { createAppShellStore } from "../../../apps/desktop/src/renderer/src/stores/app-shell-store";
import type {
  PiDeskAgentEvent,
  ShellSnapshot,
} from "../../../packages/shared/src";

type AppShellStoreApi = Parameters<typeof createAppShellStore>[0];

function createApiFixture(
  overrides: Partial<AppShellStoreApi> = {},
): AppShellStoreApi {
  const listeners = new Set<(event: PiDeskAgentEvent) => void>();

  return {
    shell: {
      getSnapshot: vi.fn(async () => ({
        appName: "PiDesk",
        appVersion: "0.1.0",
        chromeVersion: "141.0.0.0",
        platform: "darwin",
        mode: "test",
        catalog: {
          repositories: [],
          selection: {
            repositoryId: "/tmp/repo",
            worktreeId: "/tmp/repo",
            threadId: "thread-1",
          },
        },
      })),
    },
    agent: {
      getProviders: vi.fn(async () => [
        {
          id: "google",
          name: "Google",
          models: [
            {
              id: "gemini-2.5-pro",
              name: "Gemini 2.5 Pro",
              providerId: "google",
            },
          ],
        },
      ]),
      getSettings: vi.fn(async () => ({
        currentProviderId: "google",
        currentModelId: "gemini-2.5-pro",
      })),
      getSnapshot: vi.fn(async () => ({
        sessionId: "agent-session",
        status: "ready",
        messages: [],
        lastError: null,
      })),
      prompt: vi.fn(async () => undefined),
      cancelPrompt: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
      switchModel: vi.fn(async () => undefined),
      getDiscovery: vi.fn(async () => ({
        isInstalled: false,
        skills: [],
        commands: [],
      })),
      getSlashSuggestions: vi.fn(async () => ({
        kind: "slash",
        suggestions: [],
        hasMore: false,
      })),
      subscribe: vi.fn((next) => {
        listeners.add(next);
        return () => {
          listeners.delete(next);
        };
      }),
    },
    repositories: {
      add: vi.fn(async () => undefined),
      select: vi.fn(async () => undefined),
    },
    worktrees: {
      create: vi.fn(async () => undefined),
      select: vi.fn(async () => undefined),
    },
    threads: {
      create: vi.fn(async () => undefined),
      select: vi.fn(async () => undefined),
      archive: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
    },
    dialog: {
      showOpenDialog: vi.fn(async () => null),
    },
    fs: {
      readDirectory: vi.fn(async () => ({ path: "/tmp/repo", entries: [] })),
      readFile: vi.fn(async () => ({
        type: "text",
        content: "",
        encoding: "utf-8",
      })),
      writeFile: vi.fn(async () => undefined),
      getImageMetadata: vi.fn(async () => ({
        width: 1,
        height: 1,
        mimeType: "image/png",
      })),
      getImagePreview: vi.fn(async () => ({
        dataUrl: "data:image/png;base64,AA==",
      })),
    },
    terminal: {
      create: vi.fn(async () => ({
        id: "term-1",
        backend: "shell",
        cwd: "/tmp/repo",
        status: "ready",
        ownerWindowId: "window-1",
        createdAt: 1,
      })),
      write: vi.fn(async () => undefined),
      resize: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
      getSessions: vi.fn(async () => []),
      onEvent: vi.fn(() => () => undefined),
    },
    search: {
      searchFiles: vi.fn(async () => ({
        query: "",
        results: [],
        total: 0,
        duration: 0,
      })),
    },
    state: {
      getRepositoryPreferences: vi.fn(async () => null),
      updateRepositoryPreferences: vi.fn(async () => ({
        repositoryId: "/tmp/repo",
        customName: null,
        icon: null,
        accentColor: null,
      })),
      getWorkspaceSession: vi.fn(async () => null),
      saveWorkspaceSession: vi.fn(async (session) => session),
      getAppPreferences: vi.fn(async () => ({})),
      updateAppPreferences: vi.fn(async (updates) => updates),
      importLegacyPreferences: vi.fn(async () => ({
        repositoryPreferences: [],
        appPreferences: {},
      })),
    },
    window: {
      create: vi.fn(async () => {
        throw new Error("unused");
      }),
      close: vi.fn(async () => undefined),
      focus: vi.fn(async () => undefined),
      move: vi.fn(async () => undefined),
      resize: vi.fn(async () => undefined),
      minimize: vi.fn(async () => undefined),
      maximize: vi.fn(async () => undefined),
      restore: vi.fn(async () => undefined),
      getLayout: vi.fn(async () => ({
        windows: [],
        nextZIndex: 1,
        focusedWindowId: null,
        snapGridSize: 16,
      })),
    },
    ...overrides,
  } as AppShellStoreApi;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("app-shell-store", () => {
  it("loads provider state, app preferences, and migrates legacy renderer preferences once", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    });
    storage.set(
      STORAGE_KEY,
      JSON.stringify({ interface: { theme: "dark", sidebarWidth: 320 } }),
    );
    storage.set("pidesk.leftSidebarWidth", "260");

    const api = createApiFixture();
    const store = createAppShellStore(api);

    await store.getState().initialize();

    expect(store.getState().providerSnapshots).toHaveLength(1);
    expect(store.getState().settingsSnapshot.currentModelId).toBe(
      "gemini-2.5-pro",
    );
    expect(store.getState().appPreferences.leftSidebarWidth).toBe(260);
    expect(
      (
        store.getState().appPreferences as {
          settings?: { interface?: Record<string, unknown> };
        }
      ).settings?.interface,
    ).toMatchObject({
      sidebarWidth: 260,
    });
    expect(api.state.updateAppPreferences).toHaveBeenCalledWith({
      leftSidebarWidth: 260,
      settings: {
        ...DEFAULT_SETTINGS,
        interface: {
          ...DEFAULT_SETTINGS.interface,
          sidebarWidth: 260,
        },
      },
    });
  });

  it("applies the saved AI provider and model preference during initialize when runtime settings differ", async () => {
    const api = createApiFixture({
      state: {
        getRepositoryPreferences: vi.fn(async () => null),
        updateRepositoryPreferences: vi.fn(async () => ({
          repositoryId: "/tmp/repo",
          customName: null,
          icon: null,
          accentColor: null,
        })),
        getWorkspaceSession: vi.fn(async () => null),
        saveWorkspaceSession: vi.fn(async (session) => session),
        getAppPreferences: vi.fn(async () => ({
          settings: {
            ai: {
              provider: "anthropic",
              model: "claude-sonnet-4-20250514",
            },
          },
        })),
        updateAppPreferences: vi.fn(async (updates) => updates),
        importLegacyPreferences: vi.fn(async () => ({
          repositoryPreferences: [],
          appPreferences: {},
        })),
      },
      agent: {
        getProviders: vi.fn(async () => [
          {
            id: "google",
            name: "Google",
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                providerId: "google",
              },
            ],
          },
          {
            id: "anthropic",
            name: "Anthropic",
            models: [
              {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                providerId: "anthropic",
              },
            ],
          },
        ]),
        getSettings: vi
          .fn()
          .mockResolvedValueOnce({
            currentProviderId: "google",
            currentModelId: "gemini-2.5-pro",
          })
          .mockResolvedValueOnce({
            currentProviderId: "anthropic",
            currentModelId: "claude-sonnet-4-20250514",
          }),
        getSnapshot: vi.fn(async () => ({
          sessionId: "agent-session",
          status: "ready" as const,
          messages: [],
          lastError: null,
        })),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        reset: vi.fn(async () => undefined),
        switchModel: vi.fn(async () => undefined),
        getDiscovery: vi.fn(async () => ({
          isInstalled: false,
          skills: [],
          commands: [],
        })),
        getSlashSuggestions: vi.fn(async () => ({
          kind: "slash" as const,
          suggestions: [],
          hasMore: false,
        })),
        subscribe: vi.fn(() => () => undefined),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();

    expect(api.agent.switchModel).toHaveBeenCalledWith({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    });
    expect(store.getState().settingsSnapshot).toMatchObject({
      currentProviderId: "anthropic",
      currentModelId: "claude-sonnet-4-20250514",
    });
  });

  it("switches models through the transport boundary and refreshes renderer-facing state", async () => {
    const api = createApiFixture();
    const store = createAppShellStore(api);

    await store.getState().initialize();
    await store.getState().switchModel({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });

    expect(api.agent.switchModel).toHaveBeenCalledWith({
      providerId: "google",
      modelId: "gemini-2.5-pro",
    });
    expect(store.getState().isSwitchingModel).toBe(false);
    expect(api.agent.getSettings).toHaveBeenCalledTimes(2);
    expect(api.shell.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("cancels prompts through the transport boundary and syncs shell state", async () => {
    const api = createApiFixture();
    const store = createAppShellStore(api);

    await store.getState().initialize();
    await store.getState().cancelPrompt();

    expect(api.agent.cancelPrompt).toHaveBeenCalledTimes(1);
  });

  it("keeps saved AI preferences in sync when prompt-dock model switching succeeds", async () => {
    const api = createApiFixture({
      state: {
        getRepositoryPreferences: vi.fn(async () => null),
        updateRepositoryPreferences: vi.fn(async () => ({
          repositoryId: "/tmp/repo",
          customName: null,
          icon: null,
          accentColor: null,
        })),
        getWorkspaceSession: vi.fn(async () => null),
        saveWorkspaceSession: vi.fn(async (session) => session),
        getAppPreferences: vi.fn(async () => ({
          settings: {
            ai: {
              provider: "google",
              model: "gemini-2.5-pro",
            },
          },
        })),
        updateAppPreferences: vi.fn(async (updates) => updates),
        importLegacyPreferences: vi.fn(async () => ({
          repositoryPreferences: [],
          appPreferences: {},
        })),
      },
      agent: {
        getProviders: vi.fn(async () => [
          {
            id: "google",
            name: "Google",
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                providerId: "google",
              },
            ],
          },
          {
            id: "anthropic",
            name: "Anthropic",
            models: [
              {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                providerId: "anthropic",
                contextWindow: 200000,
              },
            ],
          },
        ]),
        getSettings: vi
          .fn()
          .mockResolvedValueOnce({
            currentProviderId: "google",
            currentModelId: "gemini-2.5-pro",
          })
          .mockResolvedValueOnce({
            currentProviderId: "anthropic",
            currentModelId: "claude-sonnet-4-20250514",
          }),
        getSnapshot: vi.fn(async () => ({
          sessionId: "agent-session",
          status: "ready" as const,
          messages: [],
          lastError: null,
        })),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        reset: vi.fn(async () => undefined),
        switchModel: vi.fn(async () => undefined),
        getDiscovery: vi.fn(async () => ({
          isInstalled: false,
          skills: [],
          commands: [],
        })),
        getSlashSuggestions: vi.fn(async () => ({
          kind: "slash" as const,
          suggestions: [],
          hasMore: false,
        })),
        subscribe: vi.fn(() => () => undefined),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();
    await store.getState().switchModel({
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    });

    expect(api.state.updateAppPreferences).toHaveBeenLastCalledWith({
      leftSidebarWidth: 280,
      settings: expect.objectContaining({
        ai: expect.objectContaining({
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        }),
      }),
    });
    expect(store.getState().settingsSnapshot).toMatchObject({
      currentProviderId: "anthropic",
      currentModelId: "claude-sonnet-4-20250514",
    });
  });

  it("preserves saved AI preferences when unrelated settings updates are persisted", async () => {
    const api = createApiFixture({
      state: {
        getRepositoryPreferences: vi.fn(async () => null),
        updateRepositoryPreferences: vi.fn(async () => ({
          repositoryId: "/tmp/repo",
          customName: null,
          icon: null,
          accentColor: null,
        })),
        getWorkspaceSession: vi.fn(async () => null),
        saveWorkspaceSession: vi.fn(async (session) => session),
        getAppPreferences: vi.fn(async () => ({
          leftSidebarWidth: 260,
          settings: {
            ai: {
              provider: "anthropic",
              model: "claude-sonnet-4-20250514",
            },
            interface: {
              sidebarWidth: 260,
            },
          },
        })),
        updateAppPreferences: vi.fn(async (updates) => updates),
        importLegacyPreferences: vi.fn(async () => ({
          repositoryPreferences: [],
          appPreferences: {},
        })),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();
    await store.getState().updateAppPreferences({
      settings: {
        ...DEFAULT_SETTINGS,
        interface: {
          ...DEFAULT_SETTINGS.interface,
          sidebarWidth: 320,
        },
      } as never,
    });

    expect(api.state.updateAppPreferences).toHaveBeenLastCalledWith({
      leftSidebarWidth: 320,
      settings: {
        ...DEFAULT_SETTINGS,
        ai: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
        },
        interface: {
          ...DEFAULT_SETTINGS.interface,
          sidebarWidth: 320,
        },
      },
    });
  });

  it("rolls back optimistic model state when runtime switching fails", async () => {
    const switchError = new Error("runtime rejected switch");
    const api = createApiFixture({
      state: {
        getRepositoryPreferences: vi.fn(async () => null),
        updateRepositoryPreferences: vi.fn(async () => ({
          repositoryId: "/tmp/repo",
          customName: null,
          icon: null,
          accentColor: null,
        })),
        getWorkspaceSession: vi.fn(async () => null),
        saveWorkspaceSession: vi.fn(async (session) => session),
        getAppPreferences: vi.fn(async () => ({
          settings: {
            ai: {
              provider: "google",
              model: "gemini-2.5-pro",
            },
          },
        })),
        updateAppPreferences: vi.fn(async (updates) => updates),
        importLegacyPreferences: vi.fn(async () => ({
          repositoryPreferences: [],
          appPreferences: {},
        })),
      },
      agent: {
        getProviders: vi.fn(async () => [
          {
            id: "google",
            name: "Google",
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                providerId: "google",
              },
            ],
          },
          {
            id: "anthropic",
            name: "Anthropic",
            models: [
              {
                id: "claude-sonnet-4-20250514",
                name: "Claude Sonnet 4",
                providerId: "anthropic",
              },
            ],
          },
        ]),
        getSettings: vi.fn(async () => ({
          currentProviderId: "google",
          currentModelId: "gemini-2.5-pro",
        })),
        getSnapshot: vi.fn(async () => ({
          sessionId: "agent-session",
          status: "ready" as const,
          messages: [],
          lastError: null,
        })),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        reset: vi.fn(async () => undefined),
        switchModel: vi.fn(async () => {
          throw switchError;
        }),
        getDiscovery: vi.fn(async () => ({
          isInstalled: false,
          skills: [],
          commands: [],
        })),
        getSlashSuggestions: vi.fn(async () => ({
          kind: "slash" as const,
          suggestions: [],
          hasMore: false,
        })),
        subscribe: vi.fn(() => () => undefined),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();

    await expect(
      store.getState().switchModel({
        providerId: "anthropic",
        modelId: "claude-sonnet-4-20250514",
      }),
    ).rejects.toThrow("runtime rejected switch");

    expect(store.getState().settingsSnapshot).toMatchObject({
      currentProviderId: "google",
      currentModelId: "gemini-2.5-pro",
    });
    expect(store.getState().appPreferences.settings).toEqual(
      expect.objectContaining({
        ai: {
          provider: "google",
          model: "gemini-2.5-pro",
        },
      }),
    );
    expect(api.state.updateAppPreferences).not.toHaveBeenCalled();
  });

  it("synchronizes durable sidebar width with interface settings on initialize and update", async () => {
    const api = createApiFixture({
      state: {
        getRepositoryPreferences: vi.fn(async () => null),
        updateRepositoryPreferences: vi.fn(async () => ({
          repositoryId: "/tmp/repo",
          customName: null,
          icon: null,
          accentColor: null,
        })),
        getWorkspaceSession: vi.fn(async () => null),
        saveWorkspaceSession: vi.fn(async (session) => session),
        getAppPreferences: vi.fn(async () => ({ leftSidebarWidth: 310 })),
        updateAppPreferences: vi.fn(async (updates) => updates),
        importLegacyPreferences: vi.fn(async () => ({
          repositoryPreferences: [],
          appPreferences: {},
        })),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();

    expect(store.getState().appPreferences.leftSidebarWidth).toBe(310);
    expect(
      (
        store.getState().appPreferences as {
          settings?: { interface?: Record<string, unknown> };
        }
      ).settings?.interface,
    ).toMatchObject({
      sidebarWidth: 310,
    });

    await store.getState().updateAppPreferences({
      settings: {
        ...DEFAULT_SETTINGS,
        interface: {
          ...DEFAULT_SETTINGS.interface,
          sidebarWidth: 360,
        },
      },
    } as never);

    expect(api.state.updateAppPreferences).toHaveBeenLastCalledWith({
      leftSidebarWidth: 360,
      settings: {
        ...DEFAULT_SETTINGS,
        interface: {
          ...DEFAULT_SETTINGS.interface,
          sidebarWidth: 360,
        },
      },
    });
  });

  it("skips provider metadata refreshes for thread-only session changes", async () => {
    let eventListener: ((event: PiDeskAgentEvent) => void) | undefined;
    const initialShellSnapshot: ShellSnapshot = {
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      platform: "darwin",
      mode: "test" as const,
      catalog: {
        repositories: [
          {
            id: "/tmp/repo",
            name: "PiDesk",
            customName: null,
            icon: null,
            accentColor: null,
            rootPath: "/tmp/repo",
            defaultBranch: "main",
            worktrees: [
              {
                id: "/tmp/repo",
                label: "main",
                path: "/tmp/repo",
                isMain: true,
                isDetached: false,
                git: {
                  status: "ready",
                  branch: "main",
                  commit: "abc1234",
                  hasChanges: false,
                  ahead: 0,
                  behind: 0,
                  stagedCount: 0,
                  modifiedCount: 0,
                  untrackedCount: 0,
                  message: null,
                },
                threads: [
                  {
                    id: "thread-1",
                    title: "North Star",
                    isArchived: false,
                    lastActivityAt: null,
                    runtime: {
                      status: "ready",
                      lastError: null,
                    },
                  },
                  {
                    id: "thread-2",
                    title: "Archived thread",
                    isArchived: false,
                    lastActivityAt: null,
                    runtime: {
                      status: "ready",
                      lastError: null,
                    },
                  },
                ],
              },
            ],
          },
        ],
        selection: {
          repositoryId: "/tmp/repo",
          worktreeId: "/tmp/repo",
          threadId: "thread-1",
        },
      },
    };
    const nextShellSnapshot: ShellSnapshot = {
      ...initialShellSnapshot,
      catalog: {
        ...initialShellSnapshot.catalog,
        selection: {
          ...initialShellSnapshot.catalog.selection,
          threadId: "thread-2",
        },
      },
    };
    const api = createApiFixture({
      shell: {
        getSnapshot: vi
          .fn<() => Promise<ShellSnapshot>>()
          .mockResolvedValueOnce(initialShellSnapshot)
          .mockResolvedValueOnce(nextShellSnapshot),
      },
      agent: {
        getProviders: vi.fn(async () => [
          {
            id: "google",
            name: "Google",
            models: [
              {
                id: "gemini-2.5-pro",
                name: "Gemini 2.5 Pro",
                providerId: "google",
              },
            ],
          },
        ]),
        getSettings: vi.fn(async () => ({
          currentProviderId: "google",
          currentModelId: "gemini-2.5-pro",
        })),
        getSnapshot: vi
          .fn()
          .mockResolvedValueOnce({
            sessionId: "session-1",
            status: "ready" as const,
            messages: [],
            lastError: null,
          })
          .mockResolvedValueOnce({
            sessionId: "session-2",
            status: "ready" as const,
            messages: [],
            lastError: null,
          }),
        prompt: vi.fn(async () => undefined),
        cancelPrompt: vi.fn(async () => undefined),
        reset: vi.fn(async () => undefined),
        switchModel: vi.fn(async () => undefined),
        getDiscovery: vi.fn(async () => ({
          isInstalled: false,
          skills: [],
          commands: [],
        })),
        getSlashSuggestions: vi.fn(async () => ({
          kind: "slash",
          suggestions: [],
          hasMore: false,
        })),
        subscribe: vi.fn((listener) => {
          eventListener = listener;
          return () => {
            eventListener = undefined;
          };
        }),
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();
    eventListener?.({ type: "session_changed" });
    await Promise.resolve();
    await Promise.resolve();

    expect(api.agent.getProviders).toHaveBeenCalledTimes(1);
    expect(api.agent.getSettings).toHaveBeenCalledTimes(1);
    expect(api.shell.getSnapshot).toHaveBeenCalledTimes(2);
    expect(api.agent.getSnapshot).toHaveBeenCalledTimes(2);
    expect(store.getState().shellState.shell.catalog.selection.threadId).toBe(
      "thread-2",
    );
  });

  it("updates repository preferences through the state API and reloads renderer-facing shell state", async () => {
    const initialShellSnapshot: ShellSnapshot = {
      appName: "PiDesk",
      appVersion: "0.1.0",
      chromeVersion: "141.0.0.0",
      platform: "darwin",
      mode: "test" as const,
      catalog: {
        repositories: [
          {
            id: "/tmp/repo",
            name: "PiDesk",
            customName: null,
            icon: null,
            accentColor: null,
            rootPath: "/tmp/repo",
            defaultBranch: "main",
            worktrees: [],
          },
        ],
        selection: {
          repositoryId: "/tmp/repo",
          worktreeId: "/tmp/repo",
          threadId: "thread-1",
        },
      },
    };
    const updatedShellSnapshot: ShellSnapshot = {
      ...initialShellSnapshot,
      catalog: {
        ...initialShellSnapshot.catalog,
        repositories: [
          {
            ...initialShellSnapshot.catalog.repositories[0],
            name: "Mission Control",
            customName: "Mission Control",
            icon: "terminal",
            accentColor: "slate",
          },
        ],
      },
    };
    const getSnapshot = vi
      .fn<() => Promise<typeof initialShellSnapshot>>()
      .mockResolvedValueOnce(initialShellSnapshot)
      .mockResolvedValueOnce(updatedShellSnapshot);
    const api = createApiFixture({
      shell: {
        getSnapshot,
      },
    });
    const store = createAppShellStore(api);

    await store.getState().initialize();
    const updateRepositoryPreferences = (
      store.getState() as {
        updateRepositoryPreferences?: (
          repositoryId: string,
          updates: {
            customName: string;
            icon: string;
            accentColor: string;
          },
        ) => Promise<void>;
      }
    ).updateRepositoryPreferences;

    expect(updateRepositoryPreferences).toBeTypeOf("function");

    await updateRepositoryPreferences?.("/tmp/repo", {
      customName: "Mission Control",
      icon: "terminal",
      accentColor: "slate",
    });

    expect(api.state.updateRepositoryPreferences).toHaveBeenCalledWith(
      "/tmp/repo",
      {
        customName: "Mission Control",
        icon: "terminal",
        accentColor: "slate",
      },
    );
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(
      store.getState().shellState.shell.catalog.repositories[0],
    ).toMatchObject({
      name: "Mission Control",
      customName: "Mission Control",
      icon: "terminal",
      accentColor: "slate",
    });
  });
});
