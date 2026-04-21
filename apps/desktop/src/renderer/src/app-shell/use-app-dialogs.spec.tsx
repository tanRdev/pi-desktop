// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUiInteractionStore } from "@/stores/ui-interaction-store";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../test/mock-pi-desktop";
import { useAppDialogs } from "./use-app-dialogs";

function requireNamespace(
  namespace: Record<string, ReturnType<typeof vi.fn>> | undefined,
  label: string,
) {
  if (!namespace) {
    throw new Error(`Missing mock namespace: ${label}`);
  }

  return namespace;
}

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("useAppDialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallMockPiDesktop();
  });

  it("auto-submits a requested OAuth provider for direct auth flows", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      agent: {
        getOAuthProviders: vi.fn(async () => [
          {
            id: "github-copilot",
            name: "GitHub Copilot",
            usesCallbackServer: false,
            isAuthenticated: true,
          },
        ]),
        logoutOAuth: vi.fn(async () => undefined),
      },
    });
    const agent = requireNamespace(api.agent, "agent");

    const { result } = renderHook(() =>
      useAppDialogs({ activeRepositoryId: "repo-1", reload, uiStore }),
    );

    await act(async () => {
      await result.current.openOAuthDialog("logout", "github-copilot");
    });

    expect(agent.getOAuthProviders).toHaveBeenCalledTimes(1);
    expect(agent.logoutOAuth).toHaveBeenCalledWith("github-copilot");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.oauthDialogState.open).toBe(false);
    expect(result.current.oauthDialogState.mode).toBe("providers");
  });

  it("auto-generates a worktree branch and resets dialog state on success", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      worktrees: {
        create: vi.fn(async () => undefined),
      },
    });
    const worktrees = requireNamespace(api.worktrees, "worktrees");

    const { result } = renderHook(() =>
      useAppDialogs({
        activeRepositoryId: "repo-1",
        reload,
        uiStore,
        createThreadTitle: () => "Beacon",
      }),
    );

    act(() => {
      result.current.setCreateWorktreeOpen(true);
      result.current.setNewWorktreeBranch("");
    });

    await act(async () => {
      await result.current.submitCreateWorktree();
    });

    expect(worktrees.create).toHaveBeenCalledWith("repo-1", "session/beacon");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.isCreateWorktreeOpen).toBe(false);
    expect(result.current.newWorktreeBranch).toBe("");
    expect(result.current.worktreeCreateError).toBeNull();
  });

  it("tracks repository removal confirmation and clears it after submit", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      repositories: {
        remove: vi.fn(async () => undefined),
      },
    });
    const repositories = requireNamespace(api.repositories, "repositories");

    const { result } = renderHook(() =>
      useAppDialogs({ activeRepositoryId: "repo-1", reload, uiStore }),
    );

    act(() => {
      result.current.confirmRemoveRepository({
        repositoryId: "repo-7",
        repositoryName: "Workspace Alpha",
      });
    });

    expect(result.current.confirmRemoveRepositoryName).toBe("Workspace Alpha");
    expect(result.current.isRemoveRepositoryOpen).toBe(true);

    await act(async () => {
      await result.current.submitRemoveRepository();
    });

    expect(repositories.remove).toHaveBeenCalledWith("repo-7");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.confirmRemoveRepositoryName).toBeNull();
    expect(result.current.removeRepositoryError).toBeNull();
    expect(result.current.isRemoveRepositoryOpen).toBe(false);
  });

  it("opens git init confirmation and closes it after skipping", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      repositories: {
        add: vi.fn(async () => undefined),
      },
    });
    const repositories = requireNamespace(api.repositories, "repositories");

    const { result } = renderHook(() =>
      useAppDialogs({ activeRepositoryId: "repo-1", reload, uiStore }),
    );

    act(() => {
      result.current.requestInitGitRepo("/tmp/workspace", "workspace");
    });

    expect(result.current.isInitGitRepoOpen).toBe(true);
    expect(result.current.initGitRepoPath).toBe("/tmp/workspace");
    expect(result.current.initGitRepoName).toBe("workspace");

    await act(async () => {
      await result.current.skipInitGitRepo();
    });

    expect(repositories.add).toHaveBeenCalledWith("/tmp/workspace");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.isInitGitRepoOpen).toBe(false);
    expect(result.current.initGitRepoPath).toBeNull();
    expect(result.current.initGitRepoName).toBeNull();
  });

  it("does not open the create-session dialog after a normal git init submit", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      git: {
        init: vi.fn(async () => undefined),
      },
      repositories: {
        add: vi.fn(async () => undefined),
      },
    });
    const git = requireNamespace(api.git, "git");
    const repositories = requireNamespace(api.repositories, "repositories");

    const { result } = renderHook(() =>
      useAppDialogs({ activeRepositoryId: "repo-1", reload, uiStore }),
    );

    act(() => {
      result.current.requestInitGitRepo("/tmp/workspace", "workspace");
    });

    await act(async () => {
      await result.current.submitInitGitRepo();
    });

    expect(git.init).toHaveBeenCalledWith("/tmp/workspace");
    expect(repositories.add).toHaveBeenCalledWith("/tmp/workspace");
    expect(result.current.isInitGitRepoOpen).toBe(false);
    expect(result.current.isCreateWorktreeOpen).toBe(false);
  });

  it("continues to the create-session dialog after initializing git for that flow", async () => {
    const reload = vi.fn(async () => undefined);
    const uiStore = createUiInteractionStore();
    const api = installMockPiDesktop({
      git: {
        init: vi.fn(async () => undefined),
      },
      repositories: {
        add: vi.fn(async () => undefined),
      },
    });
    const git = requireNamespace(api.git, "git");
    const repositories = requireNamespace(api.repositories, "repositories");

    const { result } = renderHook(() =>
      useAppDialogs({ activeRepositoryId: "repo-1", reload, uiStore }),
    );

    act(() => {
      result.current.requestInitGitRepo("/tmp/workspace", "workspace", {
        continueToCreateWorktree: true,
      });
    });

    await act(async () => {
      await result.current.submitInitGitRepo();
    });

    expect(git.init).toHaveBeenCalledWith("/tmp/workspace");
    expect(repositories.add).toHaveBeenCalledWith("/tmp/workspace");
    expect(result.current.isInitGitRepoOpen).toBe(false);
    expect(result.current.isCreateWorktreeOpen).toBe(true);
  });
});
