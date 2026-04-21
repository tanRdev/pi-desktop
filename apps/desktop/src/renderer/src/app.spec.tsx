// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import App from "./app";

const mockUseAppShellController = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, "piDesktop", {
    writable: true,
    value: {
      version: "0.0.0-test",
      app: { version: "0.0.0-test" },
      shell: { getSnapshot: vi.fn().mockResolvedValue({}) },
      agent: {
        getProviders: vi.fn().mockResolvedValue([]),
        getSettings: vi.fn().mockResolvedValue({}),
        getSnapshot: vi.fn().mockResolvedValue({}),
        getOAuthProviders: vi.fn().mockResolvedValue([]),
        loginWithOAuth: vi.fn().mockResolvedValue(undefined),
        logoutOAuth: vi.fn().mockResolvedValue(undefined),
        prompt: vi.fn().mockResolvedValue(undefined),
        cancelPrompt: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
        switchModel: vi.fn().mockResolvedValue(undefined),
        getDiscovery: vi.fn().mockResolvedValue({}),
        getSlashSuggestions: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockReturnValue(() => {}),
      },
      repositories: {
        add: vi.fn().mockResolvedValue(undefined),
        reorder: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        openInFinder: vi.fn().mockResolvedValue(undefined),
      },
      worktrees: {
        create: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      threads: {
        create: vi.fn().mockResolvedValue(undefined),
        select: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      dialog: {
        showOpenDialog: vi
          .fn()
          .mockResolvedValue({ canceled: true, filePaths: [] }),
        openExternal: vi.fn().mockResolvedValue(undefined),
      },
      fs: {
        readDirectory: vi.fn().mockResolvedValue([]),
        readFile: vi.fn().mockResolvedValue(""),
        writeFile: vi.fn().mockResolvedValue(undefined),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        renameFile: vi.fn().mockResolvedValue(undefined),
        moveFile: vi.fn().mockResolvedValue(undefined),
      },
      git: {
        getRepositoryStatus: vi.fn().mockResolvedValue({}),
        isRepository: vi.fn().mockResolvedValue(false),
        init: vi.fn().mockResolvedValue(undefined),
        diffFile: vi.fn().mockResolvedValue(""),
        stageFile: vi.fn().mockResolvedValue(undefined),
        stageFiles: vi.fn().mockResolvedValue(undefined),
        unstageFile: vi.fn().mockResolvedValue(undefined),
        unstageFiles: vi.fn().mockResolvedValue(undefined),
        discardFile: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue(undefined),
        fetch: vi.fn().mockResolvedValue(undefined),
        pull: vi.fn().mockResolvedValue(undefined),
        push: vi.fn().mockResolvedValue(undefined),
      },
      packages: {
        getManagerStatus: vi.fn().mockResolvedValue({}),
        searchCatalog: vi.fn().mockResolvedValue([]),
        getPackageDetail: vi.fn().mockResolvedValue({}),
        listInstalled: vi.fn().mockResolvedValue([]),
        install: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockReturnValue(() => {}),
      },
      terminal: {
        create: vi.fn().mockResolvedValue(""),
        write: vi.fn().mockResolvedValue(undefined),
        resize: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        getSessions: vi.fn().mockResolvedValue([]),
        onEvent: vi.fn().mockReturnValue(() => {}),
      },
      search: { searchFiles: vi.fn().mockResolvedValue([]) },
      state: {
        getRepositoryPreferences: vi.fn().mockResolvedValue({}),
        updateRepositoryPreferences: vi.fn().mockResolvedValue({}),
        getWorkspaceSession: vi.fn().mockResolvedValue(null),
        saveWorkspaceSession: vi.fn().mockResolvedValue({}),
        getAppPreferences: vi.fn().mockResolvedValue({}),
        updateAppPreferences: vi.fn().mockResolvedValue({}),
        importLegacyPreferences: vi.fn().mockResolvedValue(undefined),
      },
      window: {
        getFullscreenState: vi.fn().mockResolvedValue(false),
        onFullscreenChanged: vi.fn().mockReturnValue(() => {}),
      },
      updates: {
        getState: vi.fn().mockResolvedValue({ status: "idle" }),
        check: vi.fn().mockResolvedValue({ status: "idle" }),
        download: vi.fn().mockResolvedValue({ status: "idle" }),
        install: vi.fn().mockReturnValue(undefined),
        subscribe: vi.fn().mockReturnValue(() => {}),
      },
    },
  });
});

vi.mock("@/features/workspace/components/workspace-shell", () => ({
  WorkspaceShell() {
    return <div data-testid="workspace-shell">Workspace shell</div>;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster() {
    return null;
  },
}));

vi.mock("@/features/workspace/use-app-shell-controller", () => ({
  useAppShellController() {
    return mockUseAppShellController();
  },
}));

vi.mock("@/features/command-palette", () => ({
  CommandPaletteHost() {
    return null;
  },
}));

vi.mock("@/features/settings", () => ({
  SettingsHost() {
    return null;
  },
}));

vi.mock("@/lib/keyboard", () => ({
  KeyboardHost() {
    return null;
  },
}));

vi.mock("@/features/notifications", () => ({
  NotificationHost() {
    return null;
  },
}));

vi.mock("@/lib/perf", () => ({
  PerfHost() {
    return null;
  },
}));

vi.mock("./components/error-boundary", () => ({
  RootErrorBoundary({ children }: { children: React.ReactNode }) {
    return children;
  },
}));

vi.mock("./components/ui/update-banner", () => ({
  UpdateBanner() {
    return null;
  },
}));

vi.mock("@/features/workspace/components/thread-search", () => ({
  ThreadSearchHost() {
    return null;
  },
}));

vi.mock("./app-shortcuts", () => ({
  AppShortcuts() {
    return null;
  },
}));

function createController(
  oauthDialogState: Partial<{
    open: boolean;
    mode: "providers" | "login" | "logout";
    providers: {
      id: string;
      name: string;
      usesCallbackServer?: boolean;
      isAuthenticated?: boolean;
    }[];
    requestedProviderId: string | null;
    isBusy: boolean;
  }> = {},
) {
  return {
    workspaceShellProps: {},
    isCreateWorktreeOpen: false,
    setCreateWorktreeOpen: vi.fn(),
    newWorktreeBranch: "",
    setNewWorktreeBranch: vi.fn(),
    submitCreateWorktree: vi.fn(async () => undefined),
    worktreeCreateError: null,
    oauthDialogState: {
      open: false,
      mode: "providers" as const,
      providers: [],
      requestedProviderId: null,
      isBusy: false,
      ...oauthDialogState,
    },
    setOAuthDialogOpen: vi.fn(),
    submitOAuthDialog: vi.fn(async () => undefined),
    isRemoveRepositoryOpen: false,
    setRemoveRepositoryOpen: vi.fn(),
    confirmRemoveRepositoryName: null,
    removeRepositoryError: null,
    submitRemoveRepository: vi.fn(async () => undefined),
    isInitGitRepoOpen: false,
    setInitGitRepoOpen: vi.fn(),
    initGitRepoName: null,
    submitInitGitRepo: vi.fn(async () => undefined),
    skipInitGitRepo: vi.fn(async () => undefined),
  };
}

describe("App OAuth dialog", () => {
  it.skip("shows logout-specific row actions and disables providers that are not connected", () => {
    mockUseAppShellController.mockReturnValue(
      createController({
        open: true,
        mode: "logout",
        providers: [
          {
            id: "anthropic",
            name: "Anthropic (Claude Pro/Max)",
            usesCallbackServer: false,
            isAuthenticated: true,
          },
          {
            id: "github-copilot",
            name: "GitHub Copilot",
            usesCallbackServer: false,
            isAuthenticated: false,
          },
        ],
      }),
    );

    render(<App />);

    expect(
      screen.getByRole("button", {
        name: /anthropic \(claude pro\/max\).*sign out/i,
      }),
    ).toBeEnabled();

    expect(
      screen.getByRole("button", {
        name: /github copilot.*not connected/i,
      }),
    ).toBeDisabled();
  });
});
