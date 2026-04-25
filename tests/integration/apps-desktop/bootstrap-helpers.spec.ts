import { IPC_CHANNELS } from "@pi-desktop/shared";
import { describe, expect, test, vi } from "vitest";

describe("bootstrap helpers (RED)", () => {
  test("createAndTrackMainWindow keeps fullscreen subscription and closed cleanup out of index bootstrap", async () => {
    const { createAndTrackMainWindow } = await import(
      "../../../apps/desktop/src/main/bootstrap/main-window-lifecycle"
    );

    const window = {
      on: vi.fn(),
    };
    const createWindow = vi.fn(async () => window);
    const setMainWindow = vi.fn();
    const subscribeToFullscreenChanges = vi.fn(() => vi.fn());
    const setStoredMainWindow = vi.fn();

    const result = await createAndTrackMainWindow({
      createWindow,
      setMainWindow,
      subscribeToFullscreenChanges,
      setStoredMainWindow,
    });

    expect(result).toBe(window);
    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(setMainWindow).toHaveBeenCalledWith(window);
    expect(subscribeToFullscreenChanges).toHaveBeenCalledWith(window);
    expect(setStoredMainWindow).toHaveBeenCalledWith(window);
    expect(window.on).toHaveBeenCalledWith("closed", expect.any(Function));

    const onClosed = window.on.mock.calls[0]?.[1];
    const unsubscribeFullscreen =
      subscribeToFullscreenChanges.mock.results[0]?.value;

    expect(typeof onClosed).toBe("function");
    expect(typeof unsubscribeFullscreen).toBe("function");

    onClosed();

    expect(unsubscribeFullscreen).toHaveBeenCalledTimes(1);
    expect(setStoredMainWindow).toHaveBeenLastCalledWith(null);

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/main-window-lifecycle"');
    expect(source).toContain("await createAndTrackMainWindow({");
    expect(source).not.toContain(
      "let unsubscribeFullscreen = subscribeToFullscreenChanges(mainWindow);",
    );
    expect(source).not.toContain('mainWindow.on("closed", () => {');
  });

  test("main-window bootstrap preserves construction and fullscreen wiring while keeping both helpers out of index bootstrap", async () => {
    const { createMainWindowWithDependencies, subscribeToFullscreenChanges } =
      await import("../../../apps/desktop/src/main/bootstrap/main-window");

    const show = vi.fn();
    const once = vi.fn();
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const loadFile = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn();
    const on = vi.fn();
    const removeListener = vi.fn();
    const isFullScreen = vi.fn(() => true);
    const window = {
      show,
      once,
      loadURL,
      loadFile,
      webContents: {
        send,
      },
      on,
      removeListener,
      isFullScreen,
    };

    const BrowserWindow = vi.fn(function BrowserWindowMock() {
      return window;
    });
    const createMainWindowOptions = vi.fn(() => ({
      show: false,
      paintWhenInitiallyHidden: true,
    }));
    const resolvePreloadTarget = vi.fn(() => "/tmp/preload/index.cjs");
    const hardenMainWindow = vi.fn();
    const shouldShowMainWindow = vi.fn(() => true);
    const shouldDeferWindowShowUntilReady = vi.fn(() => true);
    const rendererTarget: {
      kind: "url";
      value: string;
    } = {
      kind: "url",
      value: "http://127.0.0.1:5173",
    };
    const resolveRendererTarget = vi.fn(() => rendererTarget);

    const result = await createMainWindowWithDependencies({
      env: {
        ELECTRON_RENDERER_URL: "http://127.0.0.1:5173",
      },
      mainEntryUrl: "file:///tmp/out/main/index.js",
      dependencies: {
        BrowserWindow,
        createMainWindowOptions,
        resolvePreloadTarget,
        hardenMainWindow,
        shouldShowMainWindow,
        shouldDeferWindowShowUntilReady,
        resolveRendererTarget,
      },
    });

    expect(result).toBe(window);
    expect(resolvePreloadTarget).toHaveBeenCalledWith(
      "file:///tmp/out/main/index.js",
    );
    expect(createMainWindowOptions).toHaveBeenCalledWith({
      preloadPath: "/tmp/preload/index.cjs",
    });
    expect(BrowserWindow).toHaveBeenCalledWith({
      show: false,
      paintWhenInitiallyHidden: true,
    });
    expect(hardenMainWindow).toHaveBeenCalledWith(window);
    expect(shouldShowMainWindow).toHaveBeenCalledWith({
      ELECTRON_RENDERER_URL: "http://127.0.0.1:5173",
    });
    expect(shouldDeferWindowShowUntilReady).toHaveBeenCalledWith({
      show: false,
      paintWhenInitiallyHidden: true,
    });
    expect(once).toHaveBeenCalledWith("ready-to-show", expect.any(Function));
    expect(resolveRendererTarget).toHaveBeenCalledWith(
      "http://127.0.0.1:5173",
      "file:///tmp/out/main/index.js",
    );
    expect(loadURL).toHaveBeenCalledWith("http://127.0.0.1:5173");
    expect(loadFile).not.toHaveBeenCalled();

    const showWindow = once.mock.calls[0]?.[1];
    expect(typeof showWindow).toBe("function");
    showWindow();
    expect(show).toHaveBeenCalledTimes(1);

    const unsubscribeFullscreen = subscribeToFullscreenChanges(window);
    expect(on).toHaveBeenCalledWith("enter-full-screen", expect.any(Function));
    expect(on).toHaveBeenCalledWith("leave-full-screen", expect.any(Function));
    expect(on).toHaveBeenCalledWith("ready-to-show", expect.any(Function));

    const emitFullscreenState = on.mock.calls[0]?.[1];
    expect(typeof emitFullscreenState).toBe("function");
    emitFullscreenState();

    expect(send).toHaveBeenCalledWith(
      IPC_CHANNELS.window.fullscreenChanged,
      true,
    );

    unsubscribeFullscreen();
    expect(removeListener).toHaveBeenCalledWith(
      "enter-full-screen",
      emitFullscreenState,
    );
    expect(removeListener).toHaveBeenCalledWith(
      "leave-full-screen",
      emitFullscreenState,
    );
    expect(removeListener).toHaveBeenCalledWith(
      "ready-to-show",
      emitFullscreenState,
    );

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/main-window"');
    expect(source).toContain("createWindow: createMainWindow,");
    expect(source).toContain("subscribeToFullscreenChanges,");
    expect(source).not.toContain("async function createMainWindow()");
    expect(source).not.toContain(
      "function subscribeToFullscreenChanges(window: BrowserWindow)",
    );
  });

  test("installApplicationMenu preserves desktop menu wiring and keeps it out of index bootstrap", async () => {
    const { installApplicationMenu } = await import(
      "../../../apps/desktop/src/main/bootstrap/application-menu"
    );

    const buildFromTemplate = vi.fn(() => ({ id: "menu" }));
    const setApplicationMenu = vi.fn();

    installApplicationMenu({
      app: {
        name: "Pi Desktop",
        isPackaged: false,
        getPath: vi.fn((name: string) => {
          if (name === "userData") {
            return "/tmp/user-data";
          }
          if (name === "exe") {
            return "/Applications/Pi Desktop.app/Contents/MacOS/Pi Desktop";
          }
          throw new Error(`Unexpected path request: ${name}`);
        }),
        relaunch: vi.fn(),
        quit: vi.fn(),
      },
      menu: {
        buildFromTemplate,
        setApplicationMenu,
      },
      dialog: {
        showMessageBox: vi.fn(),
        showMessageBoxSync: vi.fn(),
        showErrorBox: vi.fn(),
      },
      isMac: true,
      existsSync: vi.fn(() => false),
      rmSync: vi.fn(),
      runEffectVoid: vi.fn(),
    });

    expect(buildFromTemplate).toHaveBeenCalledTimes(1);
    const template = buildFromTemplate.mock.calls[0]?.[0];
    expect(Array.isArray(template)).toBe(true);
    expect(template).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Edit" }),
        expect.objectContaining({ label: "View" }),
        expect.objectContaining({ label: "Window" }),
      ]),
    );
    expect(template[0]).toEqual(
      expect.objectContaining({
        label: "Pi Desktop",
      }),
    );
    expect(
      template[0]?.submenu?.some(
        (item: { label?: string }) => item.label === "Uninstall Pi Desktop...",
      ),
    ).toBe(true);
    expect(setApplicationMenu).toHaveBeenCalledWith({ id: "menu" });

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/application-menu"');
    expect(source).toContain("installApplicationMenu({");
    expect(source).not.toContain("Menu.buildFromTemplate(template)");
  });

  test("createOAuthPromptBridge preserves prompt formatting and keeps the prompt bridge out of index bootstrap", async () => {
    const { createOAuthPromptBridge } = await import(
      "../../../apps/desktop/src/main/bootstrap/oauth-prompt-bridge"
    );

    const executeJavaScript = vi.fn().mockResolvedValue("  pasted code  ");
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const bridge = createOAuthPromptBridge({
      getMainWindow: () => ({
        webContents: {
          executeJavaScript,
        },
      }),
      openExternal,
    });

    await bridge.openExternal("https://example.com/auth");
    expect(openExternal).toHaveBeenCalledWith("https://example.com/auth");

    await expect(
      bridge.requestInput({
        providerId: "github",
        message: "Complete sign-in in your browser.",
        authUrl: "https://example.com/auth",
        verificationUri: "https://example.com/verify",
        userCode: "ABCD-EFGH",
      }),
    ).resolves.toBe("pasted code");

    expect(executeJavaScript).toHaveBeenCalledWith(
      'window.prompt("Complete sign-in in your browser.\\n\\nURL: https://example.com/auth\\n\\nVerify at: https://example.com/verify\\n\\nCode: ABCD-EFGH", "")',
      true,
    );

    executeJavaScript.mockResolvedValueOnce(null);

    await expect(
      bridge.requestInput({
        providerId: "github",
        message: "Retry sign-in.",
      }),
    ).rejects.toThrowError("OAuth input cancelled for github");

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/oauth-prompt-bridge"');
    expect(source).toContain("createOAuthPromptBridge({");
    expect(source).toContain("oauthPromptBridge,");
    expect(source).not.toContain("async function promptForOAuthInput(");
  });

  test("connectAgentHostWithRetry preserves socket retry bootstrap semantics and keeps the seam out of index bootstrap", async () => {
    const { connectAgentHostWithRetry } = await import(
      "../../../apps/desktop/src/main/bootstrap/agent-host-connection"
    );

    const firstTransport = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    const secondTransport = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
    const createTransport = vi
      .fn()
      .mockReturnValueOnce(firstTransport)
      .mockReturnValueOnce(secondTransport);
    const firstError = new Error("bootstrap failed");
    const firstHost = {
      bootstrap: vi.fn().mockRejectedValue(firstError),
    };
    const secondHost = {
      bootstrap: vi.fn().mockResolvedValue(undefined),
    };
    const createHost = vi
      .fn()
      .mockReturnValueOnce(firstHost)
      .mockReturnValueOnce(secondHost);
    const delay = vi.fn().mockResolvedValue(undefined);
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20);

    await expect(
      connectAgentHostWithRetry({
        socketPath: "/tmp/pi.sock",
        createTransport,
        createHost,
        delay,
        now,
        timeoutMs: 50,
        retryMs: 5,
      }),
    ).resolves.toEqual({
      host: secondHost,
      transport: secondTransport,
    });

    expect(createTransport).toHaveBeenNthCalledWith(1, "/tmp/pi.sock");
    expect(createTransport).toHaveBeenNthCalledWith(2, "/tmp/pi.sock");
    expect(createHost).toHaveBeenNthCalledWith(1, firstTransport);
    expect(createHost).toHaveBeenNthCalledWith(2, secondTransport);
    expect(firstHost.bootstrap).toHaveBeenCalledTimes(1);
    expect(secondHost.bootstrap).toHaveBeenCalledTimes(1);
    expect(firstTransport.close).toHaveBeenCalledTimes(1);
    expect(secondTransport.close).not.toHaveBeenCalled();
    expect(delay).toHaveBeenCalledWith(5);

    await expect(
      connectAgentHostWithRetry({
        socketPath: "/tmp/never.sock",
        createTransport: vi.fn(),
        createHost: vi.fn(),
        delay: vi.fn(),
        now: vi.fn(() => 100),
        timeoutMs: 0,
        retryMs: 5,
      }),
    ).rejects.toThrowError(
      "Timed out connecting to agent session socket at /tmp/never.sock",
    );

    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/thread-context-actions.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/agent-host-connection"');
    expect(source).toContain('from "./bootstrap/thread-context-actions"');
    expect(source).not.toContain("async function connectSocketHost(");
    expect(source).not.toContain("function delay(ms: number)");
    expect(helperSource).toContain("deps.connectAgentHost(");
  });

  test("routePromptToTerminal preserves prompt validation and terminal-routing behavior", async () => {
    const { routePromptToTerminal } = await import(
      "../../../apps/desktop/src/main/bootstrap/route-to-terminal"
    );

    const write = vi.fn();
    const delay = vi.fn().mockResolvedValue(undefined);
    const getSessions = () => [
      {
        id: "shell-unlinked",
        backend: "shell" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-1",
        createdAt: 1,
      },
      {
        id: "shell-linked",
        backend: "shell" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-2",
        createdAt: 1,
        linkedThreadId: "thread-123",
      },
      {
        id: "pi-session",
        backend: "pi" as const,
        cwd: "/tmp/project",
        status: "ready",
        ownerWindowId: "win-3",
        createdAt: 1,
      },
    ];

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-unlinked",
          prompt: "   ",
          startPiIfNotLinked: false,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: false, error: "Prompt must not be empty" });

    expect(
      await routePromptToTerminal(
        {
          terminalId: "missing-session",
          prompt: "hello",
          startPiIfNotLinked: false,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({
      success: false,
      error: "Unknown terminal session: missing-session",
    });

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-unlinked",
          prompt: "  hello world  ",
          startPiIfNotLinked: true,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: true, threadId: undefined });
    expect(write.mock.calls.slice(0, 2)).toEqual([
      ["shell-unlinked", "pi\n"],
      ["shell-unlinked", "hello world\n"],
    ]);
    expect(delay).toHaveBeenCalledWith(150);

    write.mockClear();
    delay.mockClear();

    expect(
      await routePromptToTerminal(
        {
          terminalId: "shell-linked",
          prompt: "ping",
          startPiIfNotLinked: true,
        },
        {
          terminalManager: { getSessions, write },
          delay,
        },
      ),
    ).toEqual({ success: true, threadId: "thread-123" });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("shell-linked", "ping\n");
    expect(delay).not.toHaveBeenCalled();
  });

  test("routePromptToTerminal remains a local helper and is not wired into desktop IPC", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).not.toContain("routePromptToTerminal");
  });

  test("workspace removal bootstrap preserves repository and worktree removal routing while keeping the seam out of index bootstrap", async () => {
    const [source, helperSource, ipcHelperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/workspace-removal-actions.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/workspace-removal-actions"');
    expect(source).toContain(
      "const workspaceRemovalActions = createWorkspaceRemovalActions({",
    );
    expect(source).not.toContain(
      "// Clean up all worktrees belonging to this repository",
    );
    expect(source).not.toContain("const normalizedWorktreeId = path");

    expect(helperSource).toContain("async function removeRepositoryAction(");
    expect(helperSource).toContain("async function removeWorktreeAction(");
    expect(ipcHelperSource).toContain(
      "input.workspaceRemovalActions.removeRepository(repositoryId)",
    );
    expect(ipcHelperSource).toContain(
      "input.workspaceRemovalActions.removeWorktree(worktreeId)",
    );
  });

  test("shell state IPC bootstrap preserves shell snapshot and allowed path wiring while keeping the seam out of index bootstrap", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/shell-state-ipc.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/shell-state-ipc"');
    expect(source).toContain(
      "const shellStateIpc = createShellStateIpcDependencies({",
    );
    expect(source).not.toContain("getShellSnapshot: async () => {");
    expect(source).not.toContain("const roots = new Set<string>();");
    expect(source).not.toContain("const roots: string[] = [];");

    expect(helperSource).toContain("buildShellCatalog({");
    expect(helperSource).toContain("createShellSnapshot({");
    expect(helperSource).toContain("new Set(listAllowedWorkspacePaths(deps))");
    expect(source).toContain('from "./bootstrap/ipc-registration"');
    expect(source).toContain("registerIpcHandlers(");
    expect(source).toContain("createDesktopIpcHandlerDependencies({");
  });

  test("initial workspace activation bootstrap keeps fallback activation routing out of index bootstrap", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/initial-workspace-activation.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/initial-workspace-activation"');
    expect(source).toContain("await activateInitialWorkspaceSelection({");
    expect(source).not.toContain(
      'catch: (error) => fromUnknownError(error, "activateWorkspacePath")',
    );
    expect(source).not.toContain('"activateWorkspacePath fallback"');
    expect(source).not.toContain(
      'currentHost = createBootstrapErrorHost("No workspace selected")',
    );

    expect(helperSource).toContain(
      "export async function activateInitialWorkspaceSelection",
    );
    expect(helperSource).toContain(
      'fromUnknownError(error, "activateWorkspacePath")',
    );
    expect(helperSource).toContain('"activateWorkspacePath fallback"');
    expect(helperSource).toContain('"No workspace selected"');
  });

  test("app lifecycle bootstrap keeps updater and shutdown wiring out of index bootstrap", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/app-lifecycle.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/app-lifecycle"');
    expect(source).toContain("registerDesktopAppLifecycle({");
    expect(source).not.toContain("if (app.isPackaged) {");
    expect(source).not.toContain('app.once("will-quit", (event) => {');
    expect(source).not.toContain('app.on("activate", async () => {');
    expect(source).not.toContain('app.on("window-all-closed", () => {');

    expect(helperSource).toContain(
      "export function registerDesktopAppLifecycle",
    );
    expect(helperSource).toContain("initAutoUpdater({");
    expect(helperSource).toContain("Promise.allSettled([");
    expect(helperSource).toContain(
      "input.browserWindow.getAllWindows().length === 0",
    );
    expect(helperSource).toContain("shouldQuitWhenAllWindowsClosed(");
  });

  test("IPC registration bootstrap keeps dependency assembly out of index bootstrap", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/ipc-registration"');
    expect(source).toContain("registerIpcHandlers(");
    expect(source).toContain("createDesktopIpcHandlerDependencies({");
    expect(source).not.toContain("handle: createSanitizingHandle(");
    expect(source).not.toContain("agentHost: {");
    expect(source).not.toContain("stateHost: {");

    expect(helperSource).toContain(
      "export function createDesktopIpcHandlerDependencies",
    );
    expect(helperSource).toContain("createSanitizingHandle(");
    expect(helperSource).toContain("export function createAgentIpcHost(");
    expect(helperSource).toContain("generateThreadTitleFromMessage(text)");
  });

  test("agent runtime handlers move discovery, slash, search, oauth, and model switching behind an extracted bootstrap seam", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/agent-runtime-handlers.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/agent-runtime-handlers"');
    expect(source).toContain(
      "const agentRuntimeHandlers = createAgentRuntimeHandlers({",
    );
    expect(source).toContain(
      "searchFiles: agentRuntimeHandlers.handleSearchFiles,",
    );
    expect(source).toContain(
      "switchModel: agentRuntimeHandlers.handleSwitchModel,",
    );
    expect(source).toContain(
      "getOAuthProviders: agentRuntimeHandlers.handleGetOAuthProviders,",
    );
    expect(source).toContain(
      "loginWithOAuth: agentRuntimeHandlers.handleLoginWithOAuth,",
    );
    expect(source).toContain(
      "logoutOAuth: agentRuntimeHandlers.handleLogoutOAuth,",
    );
    expect(source).toContain(
      "getDiscovery: agentRuntimeHandlers.handleGetDiscovery,",
    );
    expect(source).toContain(
      "getSlashSuggestions: agentRuntimeHandlers.handleGetSlashSuggestions,",
    );
    expect(source).not.toContain("async function handleSwitchModel(");
    expect(source).not.toContain("async function handleGetDiscovery(");
    expect(source).not.toContain("async function handleGetSlashSuggestions(");
    expect(source).not.toContain("async function handleSearchFiles(");
    expect(source).not.toContain("async function handleGetOAuthProviders(");
    expect(source).not.toContain("async function handleLoginWithOAuth(");
    expect(source).not.toContain("async function handleLogoutOAuth(");

    expect(helperSource).toContain(
      "export function createAgentRuntimeHandlers(",
    );
    expect(helperSource).toContain("switchModelForContext(request");
    expect(helperSource).toContain("workspaceSearchService.search(request)");
    expect(helperSource).toContain(
      "discoverPiResources(resolveAgentDirectory(), resolveContextCwd())",
    );
    expect(helperSource).toContain("getPiSlashSuggestions({");
    expect(helperSource).toContain(
      "getOAuthProvidersForAgentDir(resolveAgentDirectory())",
    );
    expect(helperSource).toContain("notifySessionChanged();");
  });

  test("switchModelForContext preserves active-context validation and prefers the live runtime switch", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const createSettingsManager = vi.fn();
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const hostSwitchModel = vi.fn().mockResolvedValue(undefined);
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await expect(
      switchModelForContext(request, {
        currentContext: null,
        resolveAgentDirectory,
        createSettingsManager,
        currentHost: { switchModel: hostSwitchModel },
        runtimeManager: { restartThreadRuntime },
        attachContext,
        commitAttachment,
      }),
    ).rejects.toThrow("No active Pi context is selected");

    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    createSettingsManager.mockResolvedValueOnce({
      setDefaultProvider,
      setDefaultModel,
    });

    const currentContext = {
      worktreePath: "/tmp/project",
      thread: { id: "thread-1" },
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      agentDirectory: "/tmp/project/.pi/agent",
    };

    await switchModelForContext(request, {
      currentContext,
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: { switchModel: hostSwitchModel },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(resolveAgentDirectory).toHaveBeenCalledTimes(1);
    expect(createSettingsManager).toHaveBeenCalledWith(
      "/tmp/project",
      "/tmp/project/.pi/agent",
    );
    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-3-7-sonnet");
    expect(hostSwitchModel).toHaveBeenCalledWith({
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    });
    expect(restartThreadRuntime).not.toHaveBeenCalled();
    expect(attachContext).not.toHaveBeenCalled();
    expect(commitAttachment).not.toHaveBeenCalled();
  });

  test("switchModelForContext updates settings without restarting when no thread runtime is active", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    const createSettingsManager = vi.fn().mockResolvedValue({
      setDefaultProvider,
      setDefaultModel,
    });
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const hostSwitchModel = vi.fn(async () => {
      throw new Error(
        "Model switching is not supported by the active Pi runtime",
      );
    });
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await switchModelForContext(request, {
      currentContext: {
        worktreePath: "/tmp/project",
        thread: { id: "pending-thread" },
        command: [],
      },
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: { switchModel: hostSwitchModel },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-3-7-sonnet");
    expect(restartThreadRuntime).not.toHaveBeenCalled();
    expect(attachContext).not.toHaveBeenCalled();
    expect(commitAttachment).not.toHaveBeenCalled();
  });

  test("switchModelForContext writes defaults to the workspace agent directory before falling back", async () => {
    const { switchModelForContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/model-switch"
    );

    const request = {
      providerId: "anthropic",
      modelId: "claude-sonnet-4-20250514",
    };
    const resolveAgentDirectory = vi.fn(() => "/tmp/project/.pi/agent");
    const setDefaultProvider = vi.fn().mockResolvedValue(undefined);
    const setDefaultModel = vi.fn().mockResolvedValue(undefined);
    const createSettingsManager = vi.fn().mockResolvedValue({
      setDefaultProvider,
      setDefaultModel,
    });
    const restartThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const attachContext = vi.fn().mockResolvedValue({ attached: true });
    const commitAttachment = vi.fn();

    await switchModelForContext(request, {
      currentContext: {
        worktreePath: "/tmp/project",
        thread: { id: "thread-1" },
        command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      },
      resolveAgentDirectory,
      createSettingsManager,
      currentHost: {
        switchModel: vi.fn(async () => {
          throw new Error(
            "Model switching is not supported by the active Pi runtime",
          );
        }),
      },
      runtimeManager: { restartThreadRuntime },
      attachContext,
      commitAttachment,
    });

    expect(createSettingsManager).toHaveBeenCalledWith(
      "/tmp/project",
      "/tmp/project/.pi/agent",
    );
    expect(setDefaultProvider).toHaveBeenCalledWith("anthropic");
    expect(setDefaultModel).toHaveBeenCalledWith("claude-sonnet-4-20250514");
    expect(restartThreadRuntime).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    });
    expect(attachContext).toHaveBeenCalledTimes(1);
    expect(commitAttachment).toHaveBeenCalledWith({ attached: true });
  });

  test("buildThreadContext preserves repository selection, runtime options, and launch details", async () => {
    const { buildThreadContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/thread-context"
    );

    const repositoryCatalog = {
      setLastSelectedWorktree: vi.fn(),
    };
    const selectionState = {
      replace: vi.fn(),
    };
    const ensureDirectory = vi.fn();
    const resolveRuntimeOptions = vi.fn(() => ({
      mode: "mock" as const,
      cwd: "/tmp/project",
      agentDir: "/tmp/project/.pi/agent",
    }));
    const createLaunchDetails = vi.fn(() => ({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      runtimeId: "pi-desktop-thread-runtime",
      socketPath: "/tmp/pi-desktop/thread.sock",
      agentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
    }));

    const thread = {
      id: "thread-1",
      worktreeId: "/tmp/project",
      title: "North Star",
      archivedAt: null,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: "2026-03-17T00:00:00.000Z",
      updatedAt: "2026-03-17T00:00:00.000Z",
    };

    const inspection = {
      rootPath: "/tmp/repo",
      currentWorktreePath: "/tmp/project",
      worktrees: [],
      defaultBranch: "main",
    };

    const result = buildThreadContext({
      repositoryId: "repo-1",
      inspection,
      thread,
      environment: { NODE_ENV: "test" },
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      repositoryCatalog,
      selectionState,
      ensureDirectory,
      resolveRuntimeOptions,
      createLaunchDetails,
    });

    expect(repositoryCatalog.setLastSelectedWorktree).toHaveBeenCalledWith(
      "repo-1",
      "/tmp/project",
    );
    expect(selectionState.replace).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreeId: "/tmp/project",
      threadId: "thread-1",
    });
    expect(resolveRuntimeOptions).toHaveBeenCalledWith(
      { NODE_ENV: "test" },
      "/tmp/project",
    );
    expect(ensureDirectory).toHaveBeenCalledWith("/tmp/project/.pi/agent", {
      recursive: true,
    });
    expect(createLaunchDetails).toHaveBeenCalledWith({
      threadId: "thread-1",
      worktreePath: "/tmp/project",
      mode: "mock",
      socketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: "test",
      agentDirectory: "/tmp/project/.pi/agent",
    });
    expect(result).toEqual({
      repositoryId: "repo-1",
      worktreePath: "/tmp/project",
      thread,
      socketPath: "/tmp/pi-desktop/thread.sock",
      runtimeId: "pi-desktop-thread-runtime",
      command: ["env", "NODE_ENV=test", "node", "/tmp/session-server.mjs"],
      agentMode: "mock",
      agentDirectory: "/tmp/project/.pi/agent",
      runtimeAgentDirectory: "/tmp/project/.pi/agent/threads/thread-1",
    });
  });

  test("resolveWorkspaceInspection treats plain folders as thread-capable workspaces", async () => {
    const { resolveWorkspaceInspection } = await import(
      "../../../apps/desktop/src/main/bootstrap/workspace-inspection"
    );

    expect(
      resolveWorkspaceInspection("/tmp/folder-workspace", {
        status: "not_repo",
        message: null,
      }),
    ).toEqual({
      rootPath: "/tmp/folder-workspace",
      currentWorktreePath: "/tmp/folder-workspace",
      worktrees: [],
      defaultBranch: null,
    });

    expect(
      resolveWorkspaceInspection("/tmp/missing-workspace", {
        status: "unavailable",
        message: "boom",
      }),
    ).toBeNull();
  });

  test("buildThreadContext skips directory creation when agentDir is absent", async () => {
    const { buildThreadContext } = await import(
      "../../../apps/desktop/src/main/bootstrap/thread-context"
    );

    const ensureDirectory = vi.fn();
    const createLaunchDetails = vi.fn(() => ({
      threadId: "thread-2",
      worktreePath: "/tmp/project",
      runtimeId: "thread-2-runtime",
      socketPath: "/tmp/pi-desktop/thread-2.sock",
      agentDirectory: "/tmp/project/.pi/agent/threads/thread-2",
      command: ["node", "/tmp/session-server.mjs"],
    }));

    const result = buildThreadContext({
      repositoryId: "repo-2",
      inspection: {
        rootPath: "/tmp/repo",
        currentWorktreePath: "/tmp/project",
        worktrees: [],
      },
      thread: {
        id: "thread-2",
        worktreeId: "/tmp/project",
        title: "Fresh Orbit",
        archivedAt: null,
        lastActivityAt: null,
        runtimeId: null,
        createdAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
      },
      environment: {},
      runtimeSocketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      repositoryCatalog: {
        setLastSelectedWorktree: vi.fn(),
      },
      selectionState: {
        replace: vi.fn(),
      },
      ensureDirectory,
      resolveRuntimeOptions: () => ({
        mode: "cli",
        cwd: "/tmp/project",
        agentDir: null,
      }),
      createLaunchDetails,
    });

    expect(ensureDirectory).not.toHaveBeenCalled();
    expect(createLaunchDetails).toHaveBeenCalledWith({
      threadId: "thread-2",
      worktreePath: "/tmp/project",
      mode: "cli",
      socketDirectory: "/tmp/pi-desktop/sockets",
      execPath: "/usr/local/bin/node",
      sessionServerEntryPath: "/tmp/session-server.mjs",
      nodeEnv: undefined,
      agentDirectory: null,
    });
    expect(result.agentDirectory).toBeNull();
    expect(result.runtimeAgentDirectory).toBe(
      "/tmp/project/.pi/agent/threads/thread-2",
    );
    expect(result.agentMode).toBe("cli");
  });

  test("active thread archive and delete fall back to no selection through the extracted helper seam", async () => {
    const [indexSource, helperSource, workspaceSelectionSource, ipcSource] =
      await Promise.all([
        import("node:fs/promises").then((fs) =>
          fs.readFile(
            new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
            "utf8",
          ),
        ),
        import("node:fs/promises").then((fs) =>
          fs.readFile(
            new URL(
              "../../../apps/desktop/src/main/bootstrap/active-thread-deletion.ts",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
        import("node:fs/promises").then((fs) =>
          fs.readFile(
            new URL(
              "../../../apps/desktop/src/main/bootstrap/workspace-selection-actions.ts",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
        import("node:fs/promises").then((fs) =>
          fs.readFile(
            new URL(
              "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ]);

    expect(indexSource).toContain(
      'from "./bootstrap/workspace-selection-actions"',
    );
    expect(indexSource).toContain('from "./bootstrap/ipc-registration"');
    expect(indexSource).not.toContain("const nextOpenThread = threadCatalog");

    expect(helperSource).toContain("const nextOpenThread = deps");
    expect(helperSource).toContain("deps.selectWorktreeWithoutThread(");
    expect(helperSource).toContain("deps.switchContextInBackground(context);");
    expect(ipcSource).toContain('from "./active-thread-deletion"');
    expect(ipcSource).toContain("await deleteThreadAndRefresh(threadId, {");
    expect(workspaceSelectionSource).toContain(
      '"No active session is selected for this workspace"',
    );
  });

  test("deleteThreadAndRefresh delegates active-thread fallback decisions to a bootstrap helper", async () => {
    const { deleteThreadAndRefresh } = await import(
      "../../../apps/desktop/src/main/bootstrap/active-thread-deletion"
    );

    const getThread = vi.fn((threadId: string) =>
      threadId === "thread-1"
        ? { id: "thread-1", worktreeId: "/tmp/project" }
        : undefined,
    );
    const deleteThread = vi.fn();
    const listByWorktree = vi.fn(() => [
      { id: "thread-1", worktreeId: "/tmp/project" },
      { id: "thread-2", worktreeId: "/tmp/project" },
    ]);
    const notifySessionChanged = vi.fn();
    const selectWorktreeWithoutThread = vi.fn();
    const resolveThreadContext = vi.fn(async (threadId: string) => ({
      thread: { id: threadId },
    }));
    const switchContextInBackground = vi.fn();

    await deleteThreadAndRefresh("thread-1", {
      getThread,
      deleteThread,
      listByWorktree,
      getActiveThreadId: () => "thread-1",
      getSelectedRepositoryId: () => "repo-1",
      notifySessionChanged,
      selectWorktreeWithoutThread,
      resolveThreadContext,
      switchContextInBackground,
    });

    expect(deleteThread).toHaveBeenCalledWith("thread-1");
    expect(listByWorktree).toHaveBeenCalledWith("/tmp/project");
    expect(resolveThreadContext).toHaveBeenCalledWith("thread-2");
    expect(switchContextInBackground).toHaveBeenCalledWith({
      thread: { id: "thread-2" },
    });
    expect(notifySessionChanged).not.toHaveBeenCalled();
    expect(selectWorktreeWithoutThread).not.toHaveBeenCalled();

    listByWorktree.mockReturnValueOnce([
      { id: "thread-1", worktreeId: "/tmp/project" },
    ]);

    await deleteThreadAndRefresh("thread-1", {
      getThread,
      deleteThread,
      listByWorktree,
      getActiveThreadId: () => "thread-1",
      getSelectedRepositoryId: () => "repo-9",
      notifySessionChanged,
      selectWorktreeWithoutThread,
      resolveThreadContext,
      switchContextInBackground,
    });

    expect(selectWorktreeWithoutThread).toHaveBeenCalledWith(
      "repo-9",
      "/tmp/project",
    );

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    const ipcHelperSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL(
          "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/ipc-registration"');
    expect(ipcHelperSource).toContain('from "./active-thread-deletion"');
    expect(ipcHelperSource).toContain(
      "await deleteThreadAndRefresh(threadId, {",
    );
    expect(source).not.toContain(
      "const nextOpenThread = threadCatalog\n      .listByWorktree(thread.worktreeId)\n      .find((entry) => entry.id !== threadId);",
    );
  });

  test("workspace selection preserves empty workspaces until user explicitly creates a thread", async () => {
    const [source, helperSource, ipcHelperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/thread-context-actions.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(ipcHelperSource).toContain("createIfMissing: false");
    expect(ipcHelperSource).toContain("input.selectWorktreeWithoutThread(");
    expect(helperSource).toContain(
      "if (!thread && options.createIfMissing === false)",
    );
    expect(source).toContain('from "./bootstrap/ipc-registration"');
  });

  test("thread/worktree actions preserve fast-path thread creation and selection through an extracted bootstrap helper seam", async () => {
    const { createThreadWorkspaceActions } = await import(
      "../../../apps/desktop/src/main/bootstrap/thread-workspace-actions"
    );

    const switchContextInBackground = vi.fn();
    const createdThread = {
      id: "thread-2",
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Pi",
      archivedAt: null,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    };
    const existingThread = {
      id: "thread-1",
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Existing",
      archivedAt: null,
      lastActivityAt: null,
      runtimeId: null,
      createdAt: "2026-04-24T00:00:00.000Z",
      updatedAt: "2026-04-24T00:00:00.000Z",
    };
    const buildFastThreadContext = vi.fn(({ thread }) => ({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread,
    }));
    const getRepositoryIdForWorktree = vi.fn(() => "repo-1");
    const upsertRepository = vi.fn(() => ({ id: "repo-9" }));
    const createThread = vi.fn(() => createdThread);
    const getThread = vi.fn((threadId: string) =>
      threadId === existingThread.id ? existingThread : null,
    );
    const inspectWorktreeOrThrow = vi.fn((worktreeId: string) => ({
      rootPath: "/tmp/repo",
      currentWorktreePath: worktreeId,
      worktrees: [],
      defaultBranch: "main",
    }));
    const buildThreadContext = vi.fn(
      (repositoryId: string, inspection, thread) => ({
        repositoryId,
        worktreePath: inspection.currentWorktreePath,
        thread,
      }),
    );

    const actions = createThreadWorkspaceActions({
      getCurrentWorktreeId: () => "/tmp/repo/worktrees/feature",
      buildFastThreadContext,
      getRepositoryIdForWorktree,
      upsertRepository,
      createThread,
      getThread,
      inspectWorktreeOrThrow,
      buildThreadContext,
      getDefaultThreadTitle: () => "Pi",
      switchContextInBackground,
    });

    await expect(
      actions.createThread("/tmp/repo/worktrees/feature/"),
    ).resolves.toBe("thread-2");

    expect(createThread).toHaveBeenCalledWith({
      worktreeId: "/tmp/repo/worktrees/feature",
      title: "Pi",
    });
    expect(buildFastThreadContext).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createdThread,
    });
    expect(buildThreadContext).not.toHaveBeenCalled();
    expect(switchContextInBackground).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: createdThread,
    });

    switchContextInBackground.mockClear();
    buildFastThreadContext.mockClear();

    await actions.selectThread("thread-1");

    expect(buildFastThreadContext).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: existingThread,
    });
    expect(buildThreadContext).not.toHaveBeenCalled();
    expect(switchContextInBackground).toHaveBeenCalledWith({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: existingThread,
    });

    await actions.createThread("/tmp/repo/worktrees/other");
    expect(inspectWorktreeOrThrow).toHaveBeenCalledWith(
      "/tmp/repo/worktrees/other",
    );
    expect(buildThreadContext).toHaveBeenCalledWith(
      "repo-9",
      expect.objectContaining({
        currentWorktreePath: "/tmp/repo/worktrees/other",
      }),
      createdThread,
    );

    await expect(actions.selectThread("missing-thread")).rejects.toThrowError(
      "Unknown thread: missing-thread",
    );

    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
        "utf8",
      ),
    );

    expect(source).toContain('from "./bootstrap/thread-workspace-actions"');
    expect(source).toContain(
      "const threadWorkspaceActions = createThreadWorkspaceActions(",
    );
    const ipcHelperSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL(
          "../../../apps/desktop/src/main/bootstrap/ipc-registration.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    );

    expect(ipcHelperSource).toContain(
      "input.threadWorkspaceActions.createThread(worktreeId)",
    );
    expect(ipcHelperSource).toContain(
      "await input.threadWorkspaceActions.selectThread(threadId);",
    );
    expect(source).not.toContain("async function createThreadContext(");
    expect(source).not.toContain("async function resolveThreadContext(");
  });

  test("thread context attachment stays behind an extracted bootstrap helper seam", async () => {
    const [source, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/thread-context-actions.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(source).toContain('from "./bootstrap/thread-context-actions"');
    expect(source).toContain("createThreadContextActions<AgentDesktopHost");
    expect(source).toContain("const {");
    expect(source).toContain("attachToPath,");
    expect(source).not.toContain("async function attachToPath(");
    expect(source).not.toContain("async function attachContext(");
    expect(source).not.toContain("function buildFastThreadContext(");
    expect(source).not.toContain("async function createWorktreeContext(");
    expect(source).not.toContain("async function resolveDefaultThreadContext(");

    expect(helperSource).toContain(
      "export function createThreadContextActions",
    );
    expect(helperSource).toContain(
      "async function resolveDefaultThreadContext(",
    );
    expect(helperSource).toContain("async function createWorktreeContext(");
    expect(helperSource).toContain("function buildFastThreadContext(");
    expect(helperSource).toContain("async function attachContext(");
    expect(helperSource).toContain("async function attachToPath(");
  });

  test("resolveInitialWorkspaceTarget keeps a fresh catalog empty instead of seeding process.cwd", async () => {
    const { resolveInitialWorkspaceTarget } = await import(
      "../../../apps/desktop/src/main/bootstrap/initial-workspace"
    );

    expect(
      resolveInitialWorkspaceTarget({
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
        repositories: [],
      }),
    ).toEqual({
      preferredWorkspacePath: null,
      fallbackWorkspacePath: null,
      shouldPreserveEmptySelection: false,
    });

    expect(
      resolveInitialWorkspaceTarget({
        selection: {
          repositoryId: null,
          worktreeId: null,
          threadId: null,
        },
        repositories: [
          {
            id: "/tmp/repo-a",
            rootPath: "/tmp/repo-a",
            label: null,
            order: 0,
            lastSelectedWorktreeId: "/tmp/repo-a/worktrees/feature",
            addedAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    ).toEqual({
      preferredWorkspacePath: "/tmp/repo-a/worktrees/feature",
      fallbackWorkspacePath: null,
      shouldPreserveEmptySelection: false,
    });
  });

  test("createWorkspaceActivationRouter centralizes repository and folder workspace routing", async () => {
    const { createWorkspaceActivationRouter } = await import(
      "../../../apps/desktop/src/main/bootstrap/workspace-activation-router"
    );

    const attachToPath = vi.fn(async () => ({
      context: { thread: { id: "thread-1" } },
      host: { id: "host-1" },
      transport: { close: vi.fn() },
    }));
    const commitAttachment = vi.fn();
    const selectFolderWorkspace = vi.fn();
    const subscribeToHost = vi.fn(() => vi.fn());
    const resolveDefaultThreadContext = vi.fn(async () => ({
      repositoryId: "repo-1",
      worktreePath: "/tmp/repo/worktrees/feature",
      thread: { id: "thread-2" },
    }));
    const switchContextInBackground = vi.fn();
    const selectWorktreeWithoutThread = vi.fn();
    const upsertRepository = vi.fn(() => ({ id: "repo-1" }));
    const notifySessionChanged = vi.fn();

    const router = createWorkspaceActivationRouter({
      inspectPath: () => ({
        status: "repository",
        rootPath: "/tmp/repo",
        currentWorktreePath: "/tmp/repo/worktrees/feature",
        worktrees: [],
        message: null,
      }),
      attachToPath,
      commitAttachment,
      selectFolderWorkspace,
      subscribeToHost,
      nonRepositoryWorkspaceMessage:
        "This folder is open, but it is not a git repository.",
      resolveDefaultThreadContext,
      switchContextInBackground,
      upsertRepository,
      selectWorktreeWithoutThread,
      notifySessionChanged,
    });

    await router.activateWorkspacePath("/tmp/repo/worktrees/feature", {
      createIfMissing: false,
    });

    expect(attachToPath).toHaveBeenCalledWith("/tmp/repo/worktrees/feature", {
      createIfMissing: false,
    });
    expect(commitAttachment).toHaveBeenCalledWith({
      context: { thread: { id: "thread-1" } },
      host: { id: "host-1" },
      transport: expect.objectContaining({ close: expect.any(Function) }),
    });
    expect(selectFolderWorkspace).not.toHaveBeenCalled();

    resolveDefaultThreadContext.mockResolvedValueOnce(null);

    await router.switchRepositoryPath("/tmp/repo/worktrees/feature", {
      createIfMissing: false,
    });

    expect(upsertRepository).toHaveBeenCalledWith({ rootPath: "/tmp/repo" });
    expect(selectWorktreeWithoutThread).toHaveBeenCalledWith(
      "repo-1",
      "/tmp/repo/worktrees/feature",
    );
    expect(switchContextInBackground).not.toHaveBeenCalled();

    const folderRouter = createWorkspaceActivationRouter({
      inspectPath: () => ({
        status: "not_repo",
        message: null,
      }),
      attachToPath,
      commitAttachment,
      selectFolderWorkspace,
      subscribeToHost,
      nonRepositoryWorkspaceMessage:
        "This folder is open, but it is not a git repository.",
      resolveDefaultThreadContext,
      switchContextInBackground,
      upsertRepository,
      selectWorktreeWithoutThread,
      notifySessionChanged,
    });

    await folderRouter.switchRepositoryPath("/tmp/folder-workspace");

    expect(selectFolderWorkspace).toHaveBeenCalledWith(
      "/tmp/folder-workspace",
      "This folder is open, but it is not a git repository.",
      subscribeToHost,
    );
    expect(notifySessionChanged).toHaveBeenCalledTimes(1);

    const unavailableRouter = createWorkspaceActivationRouter({
      inspectPath: () => ({
        status: "unavailable",
        message: "Selected directory is unavailable",
      }),
      attachToPath,
      commitAttachment,
      selectFolderWorkspace,
      subscribeToHost,
      nonRepositoryWorkspaceMessage:
        "This folder is open, but it is not a git repository.",
      resolveDefaultThreadContext,
      switchContextInBackground,
      upsertRepository,
      selectWorktreeWithoutThread,
      notifySessionChanged,
    });

    await expect(
      unavailableRouter.activateWorkspacePath("/tmp/missing-workspace"),
    ).rejects.toThrowError("Selected directory is unavailable");

    const [indexSource, helperSource] = await Promise.all([
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL("../../../apps/desktop/src/main/index.ts", import.meta.url),
          "utf8",
        ),
      ),
      import("node:fs/promises").then((fs) =>
        fs.readFile(
          new URL(
            "../../../apps/desktop/src/main/bootstrap/workspace-activation-router.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ]);

    expect(indexSource).toContain(
      'from "./bootstrap/workspace-activation-router"',
    );
    expect(indexSource).toContain(
      "const { activateWorkspacePath, switchRepositoryPath } =",
    );
    expect(indexSource).not.toContain("async function activateWorkspacePath(");
    expect(indexSource).not.toContain("async function switchRepositoryPath(");

    expect(helperSource).toContain(
      "export function createWorkspaceActivationRouter",
    );
    expect(helperSource).toContain("async function activateWorkspacePath(");
    expect(helperSource).toContain("async function switchRepositoryPath(");
  });
});
