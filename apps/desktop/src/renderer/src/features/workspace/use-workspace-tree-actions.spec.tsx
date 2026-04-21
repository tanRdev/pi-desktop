// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import {
  createRepository,
  createThread,
  createWorktree,
} from "../../../../test/factories";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { useWorkspaceTreeActions } from "./use-workspace-tree-actions";

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

describe("useWorkspaceTreeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    uninstallMockPiDesktop();
  });

  it("adds repositories, reloads once, and requests git init for non-repos", async () => {
    const reload = vi.fn(async () => undefined);
    const clearSelectedContextSurface = vi.fn();
    const requestInitGitRepo = vi.fn();
    const api = installMockPiDesktop({
      dialog: {
        showOpenDialog: vi.fn(async () => [
          "/tmp/alpha-workspace",
          "/tmp/plain-folder",
          "/tmp/ignored-after-break",
        ]),
      },
      git: {
        isRepository: vi.fn(
          async (repositoryPath: string) =>
            repositoryPath === "/tmp/alpha-workspace",
        ),
      },
      repositories: {
        add: vi.fn(async () => undefined),
      },
    });
    const dialog = requireNamespace(api.dialog, "dialog");
    const git = requireNamespace(api.git, "git");
    const repositories = requireNamespace(api.repositories, "repositories");

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [],
        activeRepository: null,
        activeWorktree: null,
        activeWorktreeId: null,
        activeThreadId: null,
        reload,
        clearSelectedContextSurface,
        confirmRemoveRepository: vi.fn(),
        requestInitGitRepo,
        setCreateWorktreeOpen: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.addRepository();
    });

    expect(dialog.showOpenDialog).toHaveBeenCalledWith({
      properties: ["openDirectory", "multiSelections"],
      title: "Add Repository",
    });
    expect(git.isRepository).toHaveBeenCalledTimes(2);
    expect(repositories.add).toHaveBeenCalledWith("/tmp/alpha-workspace");
    expect(requestInitGitRepo).toHaveBeenCalledWith(
      "/tmp/plain-folder",
      "plain-folder",
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(clearSelectedContextSurface).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Workspace added");
  });

  it("selects repositories and threads while clearing the context surface", async () => {
    const reload = vi.fn(async () => undefined);
    const clearSelectedContextSurface = vi.fn();
    const repository = createRepository({
      id: "repo-1",
      worktrees: [
        createWorktree({
          id: "worktree-1",
          threads: [createThread({ id: "thread-1" })],
        }),
      ],
    });
    const api = installMockPiDesktop({
      repositories: {
        select: vi.fn(async () => undefined),
      },
      worktrees: {
        select: vi.fn(async () => undefined),
      },
      threads: {
        select: vi.fn(async () => undefined),
      },
    });
    const repositoriesApi = requireNamespace(api.repositories, "repositories");
    const worktrees = requireNamespace(api.worktrees, "worktrees");
    const threads = requireNamespace(api.threads, "threads");

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [repository],
        activeRepository: repository,
        activeWorktree: repository.worktrees[0] ?? null,
        activeWorktreeId: "worktree-1",
        activeThreadId: "thread-1",
        reload,
        clearSelectedContextSurface,
        confirmRemoveRepository: vi.fn(),
        requestInitGitRepo: vi.fn(),
        setCreateWorktreeOpen: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.selectRepository("repo-1");
      await result.current.selectWorktree("worktree-1");
      await result.current.selectThread("thread-1");
    });

    expect(repositoriesApi.select).toHaveBeenCalledWith("repo-1");
    expect(worktrees.select).toHaveBeenCalledWith("worktree-1");
    expect(threads.select).toHaveBeenCalledWith("thread-1");
    expect(clearSelectedContextSurface).toHaveBeenCalledTimes(2);
  });

  it("delegates session creation and repository removal through dialog actions", async () => {
    const confirmRemoveRepository = vi.fn();
    const setCreateWorktreeOpen = vi.fn();
    const repository = createRepository({
      id: "repo-7",
      name: "Alpha Workspace",
      customName: "Workspace Alpha",
    });
    installMockPiDesktop({
      git: {
        isRepository: vi.fn(async () => true),
      },
    });

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [repository],
        activeRepository: repository,
        activeWorktree: repository.worktrees[0] ?? null,
        activeWorktreeId: repository.worktrees[0]?.id ?? null,
        activeThreadId: repository.worktrees[0]?.threads[0]?.id ?? null,
        reload: vi.fn(async () => undefined),
        clearSelectedContextSurface: vi.fn(),
        confirmRemoveRepository,
        requestInitGitRepo: vi.fn(),
        setCreateWorktreeOpen,
      }),
    );

    await act(async () => {
      await result.current.createSession();
      await result.current.removeRepository("repo-7");
    });

    expect(setCreateWorktreeOpen).toHaveBeenCalledWith(true);
    expect(confirmRemoveRepository).toHaveBeenCalledWith({
      repositoryId: "repo-7",
      repositoryName: "Workspace Alpha",
    });
  });

  it("requests git init instead of opening the worktree dialog when the active project is not a git repo", async () => {
    const requestInitGitRepo = vi.fn();
    const setCreateWorktreeOpen = vi.fn();
    const repository = createRepository({
      id: "repo-8",
      name: "Plain Folder",
      customName: null,
      rootPath: "/tmp/plain-folder",
    });
    const api = installMockPiDesktop({
      git: {
        isRepository: vi.fn(async () => false),
      },
    });
    const git = requireNamespace(api.git, "git");

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [repository],
        activeRepository: repository,
        activeWorktree: repository.worktrees[0] ?? null,
        activeWorktreeId: repository.worktrees[0]?.id ?? null,
        activeThreadId: repository.worktrees[0]?.threads[0]?.id ?? null,
        reload: vi.fn(async () => undefined),
        clearSelectedContextSurface: vi.fn(),
        confirmRemoveRepository: vi.fn(),
        requestInitGitRepo,
        setCreateWorktreeOpen,
      }),
    );

    await act(async () => {
      await result.current.createSession();
    });

    expect(git.isRepository).toHaveBeenCalledWith("/tmp/plain-folder");
    expect(requestInitGitRepo).toHaveBeenCalledWith(
      "/tmp/plain-folder",
      "Plain Folder",
      {
        continueToCreateWorktree: true,
      },
    );
    expect(setCreateWorktreeOpen).not.toHaveBeenCalled();
  });

  it("creates a thread and closes the active thread by selecting the next one", async () => {
    const clearSelectedContextSurface = vi.fn();
    const worktree = createWorktree({
      id: "worktree-1",
      threads: [
        createThread({ id: "thread-1", title: "Signal" }),
        createThread({ id: "thread-2", title: "Echo" }),
      ],
    });
    const api = installMockPiDesktop({
      threads: {
        create: vi.fn(async () => "thread-3"),
        select: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
      },
    });
    const threads = requireNamespace(api.threads, "threads");

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [createRepository({ worktrees: [worktree] })],
        activeRepository: createRepository({ worktrees: [worktree] }),
        activeWorktree: worktree,
        activeWorktreeId: "worktree-1",
        activeThreadId: "thread-1",
        reload: vi.fn(async () => undefined),
        clearSelectedContextSurface,
        confirmRemoveRepository: vi.fn(),
        requestInitGitRepo: vi.fn(),
        setCreateWorktreeOpen: vi.fn(),
      }),
    );

    let createdThreadId = "";
    await act(async () => {
      createdThreadId = await result.current.createThread("worktree-1");
      await result.current.closeThread("thread-1");
    });

    expect(createdThreadId).toBe("thread-3");
    expect(threads.create).toHaveBeenCalledWith("worktree-1");
    expect(threads.select).toHaveBeenCalledWith("thread-2");
    expect(threads.delete).toHaveBeenCalledWith("thread-1");
    expect(clearSelectedContextSurface).toHaveBeenCalledTimes(1);
  });

  it("copies repository paths, opens in finder, and clears active deletions", async () => {
    const clearSelectedContextSurface = vi.fn();
    const repository = createRepository({
      id: "repo-1",
      rootPath: "/tmp/alpha",
    });
    const api = installMockPiDesktop({
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
      repositories: {
        openInFinder: vi.fn(async () => undefined),
      },
      threads: {
        delete: vi.fn(async () => undefined),
      },
      worktrees: {
        remove: vi.fn(async () => undefined),
      },
    });
    const clipboard = requireNamespace(api.clipboard, "clipboard");
    const repositoriesApi = requireNamespace(api.repositories, "repositories");
    const threads = requireNamespace(api.threads, "threads");
    const worktrees = requireNamespace(api.worktrees, "worktrees");

    const { result } = renderHook(() =>
      useWorkspaceTreeActions({
        repositories: [repository],
        activeRepository: repository,
        activeWorktree: repository.worktrees[0] ?? null,
        activeWorktreeId: repository.worktrees[0]?.id ?? null,
        activeThreadId: repository.worktrees[0]?.threads[0]?.id ?? null,
        reload: vi.fn(async () => undefined),
        clearSelectedContextSurface,
        confirmRemoveRepository: vi.fn(),
        requestInitGitRepo: vi.fn(),
        setCreateWorktreeOpen: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.copyRepositoryPath("repo-1");
      await result.current.openInFinder("repo-1");
      await result.current.deleteThread("thread-1");
      await result.current.deleteWorktree("worktree-1");
    });

    expect(clipboard.writeText).toHaveBeenCalledWith("/tmp/alpha");
    expect(repositoriesApi.openInFinder).toHaveBeenCalledWith("repo-1");
    expect(threads.delete).toHaveBeenCalledWith("thread-1");
    expect(worktrees.remove).toHaveBeenCalledWith("worktree-1");
    expect(clearSelectedContextSurface).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith("Path copied");
    expect(toast.success).toHaveBeenCalledWith("Opened in Finder");
  });
});
