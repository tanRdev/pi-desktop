import type {
  GitRepositoryStatus,
  MentionSuggestion,
  OAuthProviderSnapshot,
  SlashSuggestion,
  ThreadSnapshot,
} from "@pi-desktop/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pi-desktop/shared";
import * as React from "react";
import { useStore } from "zustand";
import {
  createThreadTitle,
  DEFAULT_UNTITLED_THREAD_TITLE,
} from "../../../thread-title-defaults";
import type { WorkspaceShellProps } from "../components/workspace/workspace-shell";
import { loadPromptAutocompleteSuggestions } from "../lib/prompt-autocomplete-loader";

export { getMainPaneState } from "../lib/workspace-pane-state";

import {
  buildFileMention,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  parseOAuthChatCommand,
  replacePromptToken,
} from "../lib/prompt-routing";
import { toast } from "../lib/toast";
import { uiInteractionStore } from "../stores/ui-interaction-store";
import {
  saveFileWindowForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
} from "../stores/workspace-session-runtime";
import { selectThreadConversationByWorktree } from "../stores/workspace-session-selectors";
import type { ThreadConversationState } from "../stores/workspace-session-store";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
  useShellModel,
} from "./use-shell-model";
import { getWorkspaceSessionStore, useWindowStore } from "./use-window-store";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];

function getErrorDescription(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
type PromptMode = "build" | "plan";

const PROMPT_MODE_TO_PREFIX = {
  build: "/skill:build ",
  plan: "/skill:plan ",
} satisfies Record<PromptMode, string>;

function stripPromptModePrefix(value: string): string {
  return value
    .replace(/^\/skill:(?:plan|build)\s+/i, "")
    .replace(/^\/(?:plan|build)\s+/i, "");
}

function detectPromptMode(value: string): PromptMode {
  if (/^\/skill:plan\b/i.test(value) || /^\/plan\b/i.test(value)) {
    return "plan";
  }

  return "build";
}

function getThreadWindowTitle(
  thread: ThreadSnapshot | null | undefined,
): string {
  const title = thread?.title.trim();
  return title && title.length > 0 ? title : DEFAULT_UNTITLED_THREAD_TITLE;
}

function getInitialContextSurface(
  windows: WorkspaceShellProps["contextWindows"],
  current: WorkspaceShellProps["selectedContextSurface"] | null,
): WorkspaceShellProps["selectedContextSurface"] {
  if (current === null || current === "activity") {
    return current;
  }

  if (windows.some((window) => window.id === current)) {
    return current;
  }

  return null;
}

export function shouldPersistThreadConversation(
  conversation: ThreadConversationState,
): boolean {
  return !(
    conversation.status === "starting" &&
    conversation.messages.length === 0 &&
    conversation.lastError === null
  );
}

export function isPromptExecutionVisible({
  activeThreadId,
  pendingPromptThreadId,
  conversation,
}: {
  activeThreadId: string | null;
  pendingPromptThreadId: string | null;
  conversation: ThreadConversationState | undefined;
}): boolean {
  return (
    conversation?.status === "streaming" ||
    (activeThreadId !== null && pendingPromptThreadId === activeThreadId)
  );
}

export interface AppShellController {
  workspaceShellProps: WorkspaceShellProps;
  oauthDialogState: {
    open: boolean;
    mode: "providers" | "login" | "logout";
    providers: OAuthProviderSnapshot[];
    requestedProviderId: string | null;
    isBusy: boolean;
  };
  setOAuthDialogOpen: (open: boolean) => void;
  submitOAuthDialog: (providerId: string) => Promise<void>;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  gitCommitMessage: string;
  setGitCommitMessage: (value: string) => void;
  refreshGitRepositoryStatus: () => Promise<void>;
  stageGitFile: (filePath: string) => Promise<void>;
  stageAllGitFiles: (filePaths: string[]) => Promise<void>;
  unstageGitFile: (filePath: string) => Promise<void>;
  unstageAllGitFiles: (filePaths: string[]) => Promise<void>;
  discardGitFile: (filePath: string) => Promise<void>;
  commitGitChanges: () => Promise<void>;
  pullGitChanges: () => Promise<void>;
  pushGitChanges: () => Promise<void>;
  fetchGitChanges: () => Promise<void>;
  commitAndPushGitChanges: () => Promise<void>;
  isCreateWorktreeOpen: boolean;
  setCreateWorktreeOpen: (isOpen: boolean) => void;
  confirmRemoveRepositoryName: string | null;
  isRemoveRepositoryOpen: boolean;
  setRemoveRepositoryOpen: (isOpen: boolean) => void;
  removeRepositoryError: string | null;
  submitRemoveRepository: () => Promise<void>;
  newWorktreeBranch: string;
  setNewWorktreeBranch: (value: string) => void;
  worktreeCreateError: string | null;
  submitCreateWorktree: () => Promise<void>;
  isInitGitRepoOpen: boolean;
  setInitGitRepoOpen: (isOpen: boolean) => void;
  initGitRepoPath: string | null;
  initGitRepoName: string | null;
  submitInitGitRepo: () => Promise<void>;
  skipInitGitRepo: () => Promise<void>;
  onAgentGitAction: (prompt: string) => void;
}

export function useAppShellController(): AppShellController {
  const {
    reload,
    sendPrompt,
    cancelPrompt,
    setDraft,
    state,
    providerSnapshots,
    settingsSnapshot,
    isSwitchingModel,
    switchModel,
    appPreferences,
    updateAppPreferences,
  } = useShellModel();
  const { agent, draft, shell } = state;
  const { state: windowState, store: windowStore } = useWindowStore();

  const activeRepository = React.useMemo(
    () => getActiveRepository(shell),
    [shell],
  );
  const activeWorktree = React.useMemo(() => getActiveWorktree(shell), [shell]);
  const activeThread = React.useMemo(() => getActiveThread(shell), [shell]);
  const platform = shell.platform ?? null;
  const repositories = shell.catalog.repositories;
  const activeRepositoryId = activeRepository?.id ?? null;
  const activeWorktreeId = activeWorktree?.id ?? null;
  const activeWorktreePath = activeWorktree?.path ?? null;
  const activeThreadId = activeThread?.id ?? null;
  const activeThreadConversation = React.useSyncExternalStore(
    getWorkspaceSessionStore().subscribe,
    () =>
      activeThreadId
        ? selectThreadConversationByWorktree(
            getWorkspaceSessionStore().getState(),
            activeWorktreeId,
            activeThreadId,
          )
        : undefined,
    () => undefined,
  );

  const autocompleteSuggestions = useStore(
    uiInteractionStore,
    (storeState) =>
      storeState.promptAutocompleteSuggestions ??
      EMPTY_AUTOCOMPLETE_SUGGESTIONS,
  );
  const autocompleteSelectedIndex = useStore(
    uiInteractionStore,
    (storeState) => storeState.promptAutocompleteSelectedIndex,
  );
  const isCreateWorktreeOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.createWorktree,
  );
  const isRemoveRepositoryOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.confirmRemoveRepository,
  );
  const isInitGitRepoOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.initGitRepo,
  );

  const [newWorktreeBranch, setNewWorktreeBranchState] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const [confirmRemoveRepositoryId, setConfirmRemoveRepositoryId] =
    React.useState<string | null>(null);
  const [confirmRemoveRepositoryName, setConfirmRemoveRepositoryName] =
    React.useState<string | null>(null);
  const [removeRepositoryError, setRemoveRepositoryError] = React.useState<
    string | null
  >(null);
  const [initGitRepoPath, setInitGitRepoPath] = React.useState<string | null>(
    null,
  );
  const [initGitRepoName, setInitGitRepoName] = React.useState<string | null>(
    null,
  );
  const [selectedContextSurface, setSelectedContextSurface] =
    React.useState<WorkspaceShellProps["selectedContextSurface"]>(null);
  const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(260);
  const [isTerminalVisible, setIsTerminalVisible] = React.useState(false);
  const [promptMode, setPromptMode] = React.useState<PromptMode>(() =>
    detectPromptMode(draft),
  );
  const [pendingPromptThreadId, setPendingPromptThreadId] = React.useState<
    string | null
  >(null);
  const [activeGitRepositoryStatus, setActiveGitRepositoryStatus] =
    React.useState<GitRepositoryStatus | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = React.useState("");
  const [oauthProviders, setOAuthProviders] = React.useState<
    OAuthProviderSnapshot[]
  >([]);
  const [oauthDialogOpen, setOAuthDialogOpenState] = React.useState(false);
  const [oauthDialogMode, setOAuthDialogMode] = React.useState<
    "providers" | "login" | "logout"
  >("providers");
  const [oauthRequestedProviderId, setOAuthRequestedProviderId] =
    React.useState<string | null>(null);
  const [isOAuthBusy, setIsOAuthBusy] = React.useState(false);
  const loadOAuthProviders = React.useCallback(async () => {
    const providers = await window.piDesktop.agent.getOAuthProviders();
    setOAuthProviders(providers);
    return providers;
  }, []);

  const setOAuthDialogOpen = React.useCallback((open: boolean) => {
    setOAuthDialogOpenState(open);
    if (!open) {
      setOAuthRequestedProviderId(null);
      setOAuthDialogMode("providers");
    }
  }, []);

  const submitOAuthDialog = React.useCallback(
    async (providerId: string) => {
      setIsOAuthBusy(true);
      try {
        if (oauthDialogMode === "logout") {
          await window.piDesktop.agent.logoutOAuth(providerId);
          toast.success("Logged out", { description: providerId });
        } else {
          await window.piDesktop.agent.loginWithOAuth(providerId);
          toast.success("Login complete", { description: providerId });
        }
        await Promise.all([reload(), loadOAuthProviders()]);
        setOAuthDialogOpen(false);
      } catch (error) {
        toast.error(
          oauthDialogMode === "logout" ? "Logout failed" : "Login failed",
          {
            description: getErrorDescription(
              error,
              oauthDialogMode === "logout"
                ? "Could not clear provider credentials"
                : "Could not complete provider authentication",
            ),
          },
        );
      } finally {
        setIsOAuthBusy(false);
      }
    },
    [loadOAuthProviders, oauthDialogMode, reload, setOAuthDialogOpen],
  );

  const openOAuthDialog = React.useCallback(
    async (
      mode: "providers" | "login" | "logout",
      providerId: string | null,
    ) => {
      try {
        const providers = await loadOAuthProviders();
        setOAuthDialogMode(mode);
        setOAuthRequestedProviderId(providerId);

        if (
          providerId &&
          mode !== "providers" &&
          providers.some((provider) => provider.id === providerId)
        ) {
          await submitOAuthDialog(providerId);
          return;
        }

        setOAuthDialogOpenState(true);
      } catch (error) {
        toast.error("Failed to load providers", {
          description: getErrorDescription(
            error,
            "Could not load OAuth providers",
          ),
        });
      }
    },
    [loadOAuthProviders, submitOAuthDialog],
  );

  const setAutocompleteSuggestions = React.useCallback(
    (suggestions: (SlashSuggestion | MentionSuggestion)[]) => {
      uiInteractionStore.getState().setPromptAutocomplete(suggestions);
    },
    [],
  );
  const setAutocompleteSelectedIndex = React.useCallback((index: number) => {
    uiInteractionStore.getState().setPromptAutocompleteSelectedIndex(index);
  }, []);
  const clearAutocomplete = React.useCallback(() => {
    uiInteractionStore.getState().clearPromptAutocomplete();
  }, []);
  const setCreateWorktreeOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("createWorktree", isOpen);
  }, []);
  const setRemoveRepositoryOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore
      .getState()
      .setDialogOpen("confirmRemoveRepository", isOpen);
  }, []);
  const setInitGitRepoOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("initGitRepo", isOpen);
    if (!isOpen) {
      setInitGitRepoPath(null);
      setInitGitRepoName(null);
    }
  }, []);

  React.useEffect(() => {
    setPromptMode(detectPromptMode(draft));
  }, [draft]);

  React.useEffect(() => {
    const conversation = {
      messages: agent.messages,
      status: agent.status,
      lastError: agent.lastError,
    } satisfies ThreadConversationState;

    if (!shouldPersistThreadConversation(conversation)) {
      return;
    }

    syncActiveThreadConversation({
      sessionStore: getWorkspaceSessionStore(),
      worktreeId: activeWorktreeId,
      threadId: activeThreadId,
      conversation,
    });
  }, [
    activeWorktreeId,
    activeThreadId,
    agent.lastError,
    agent.messages,
    agent.status,
  ]);

  React.useEffect(() => {
    if (!pendingPromptThreadId) {
      return;
    }

    if (pendingPromptThreadId !== activeThreadId) {
      setPendingPromptThreadId(null);
      return;
    }

    const activeStatus = activeThreadConversation?.status ?? agent.status;
    if (activeStatus !== "starting" && activeStatus !== "streaming") {
      setPendingPromptThreadId(null);
    }
  }, [
    activeThreadConversation?.status,
    activeThreadId,
    agent.status,
    pendingPromptThreadId,
  ]);

  React.useEffect(() => {
    if (shell.catalog.repositories.length > 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      void reload();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [reload, shell.catalog.repositories.length]);

  const canSend =
    draft.trim().length > 0 &&
    activeThreadId !== null &&
    agent.status !== "starting" &&
    agent.status !== "streaming";
  const isPromptExecuting = isPromptExecutionVisible({
    activeThreadId,
    pendingPromptThreadId,
    conversation: activeThreadConversation,
  });
  const isPromptVisible = activeThreadId !== null;

  const handleToggleTerminal = React.useCallback(() => {
    setIsTerminalVisible((prev) => !prev);
  }, []);

  const handleOpenGit = React.useCallback(() => {
    if (!activeWorktreePath) {
      return;
    }

    const existingGitWindow = windowState.layout.windows.find(
      (
        window,
      ): window is Extract<
        (typeof windowState.layout.windows)[number],
        { kind: "git" }
      > =>
        window.kind === "git" && window.repositoryPath === activeWorktreePath,
    );
    if (existingGitWindow) {
      if (existingGitWindow.id === selectedContextSurface) {
        setSelectedContextSurface(null);
        return;
      }
      windowStore.focusWindow(existingGitWindow.id);
      setSelectedContextSurface(existingGitWindow.id);
      return;
    }

    const gitWindow = windowStore.createWindow(
      { kind: "git", repositoryPath: activeWorktreePath },
      activeWorktreePath,
    );
    windowStore.updateWindow(gitWindow.id, {
      title: `Git · ${activeRepository?.name ?? "Repository"}`,
    });
    setSelectedContextSurface(gitWindow.id);
  }, [
    activeRepository?.name,
    activeWorktreePath,
    selectedContextSurface,
    windowState.layout.windows,
    windowStore,
  ]);

  const refreshGitRepositoryStatus = React.useCallback(async () => {
    if (!activeWorktreePath) {
      setActiveGitRepositoryStatus(null);
      return;
    }

    const status =
      await window.piDesktop.git.getRepositoryStatus(activeWorktreePath);
    setActiveGitRepositoryStatus(status);
  }, [activeWorktreePath]);

  React.useEffect(() => {
    let disposed = false;

    if (!activeWorktreePath) {
      setActiveGitRepositoryStatus(null);
      return;
    }

    void window.piDesktop.git
      .getRepositoryStatus(activeWorktreePath)
      .then((status) => {
        if (!disposed) {
          setActiveGitRepositoryStatus(status);
        }
      })
      .catch(() => {
        if (!disposed) {
          setActiveGitRepositoryStatus(null);
        }
      });

    return () => {
      disposed = true;
    };
  }, [activeWorktreePath]);

  const runGitMutation = React.useCallback(
    async (
      operation: () => Promise<GitRepositoryStatus>,
      successMessage: string,
    ) => {
      try {
        const status = await operation();
        setActiveGitRepositoryStatus(status);
        toast.success(successMessage);
        await reload();
      } catch (error) {
        toast.error("Git action failed", {
          description:
            error instanceof Error ? error.message : "Unknown git error",
        });
      }
    },
    [reload],
  );

  const stageGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.stageFile(activeWorktreePath, filePath),
        "File staged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const stageAllGitFiles = React.useCallback(
    async (filePaths: string[]) => {
      if (!activeWorktreePath || filePaths.length === 0) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.stageFiles(activeWorktreePath, filePaths),
        "Files staged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const unstageGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.unstageFile(activeWorktreePath, filePath),
        "File unstaged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const unstageAllGitFiles = React.useCallback(
    async (filePaths: string[]) => {
      if (!activeWorktreePath || filePaths.length === 0) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.unstageFiles(activeWorktreePath, filePaths),
        "Files unstaged",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const discardGitFile = React.useCallback(
    async (filePath: string) => {
      if (!activeWorktreePath) {
        return;
      }

      await runGitMutation(
        () => window.piDesktop.git.discardFile(activeWorktreePath, filePath),
        "Changes discarded",
      );
    },
    [activeWorktreePath, runGitMutation],
  );

  const commitGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath || !gitCommitMessage.trim()) {
      return;
    }

    try {
      const status = await window.piDesktop.git.commit(
        activeWorktreePath,
        gitCommitMessage,
      );
      setActiveGitRepositoryStatus(status);
      setGitCommitMessage("");
      toast.success("Commit created");
      await reload();
    } catch (error) {
      toast.error("Commit failed", {
        description:
          error instanceof Error ? error.message : "Unknown git error",
      });
    }
  }, [activeWorktreePath, gitCommitMessage, reload]);

  const commitAndPushGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath || !gitCommitMessage.trim()) {
      return;
    }

    try {
      let status = await window.piDesktop.git.commit(
        activeWorktreePath,
        gitCommitMessage,
      );
      status = await window.piDesktop.git.push(activeWorktreePath);
      setActiveGitRepositoryStatus(status);
      setGitCommitMessage("");
      toast.success("Committed and pushed");
      await reload();
    } catch (error) {
      toast.error("Commit & Push failed", {
        description:
          error instanceof Error ? error.message : "Unknown git error",
      });
    }
  }, [activeWorktreePath, gitCommitMessage, reload]);

  const pullGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.pull(activeWorktreePath),
      "Repository updated",
    );
  }, [activeWorktreePath, runGitMutation]);

  const pushGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.push(activeWorktreePath),
      "Changes pushed",
    );
  }, [activeWorktreePath, runGitMutation]);

  const fetchGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.piDesktop.git.fetch(activeWorktreePath),
      "Repository fetched",
    );
  }, [activeWorktreePath, runGitMutation]);

  const handleFileContentChange = React.useCallback(
    (windowId: string, newContent: string) => {
      updateFileDraftForWorktree({
        sessionStore: getWorkspaceSessionStore(),
        worktreeId: activeWorktreeId,
        windowId,
        content: newContent,
      });
      windowStore.setDirty(windowId, true);
    },
    [activeWorktreeId, windowStore],
  );

  const handleFileSave = React.useCallback(
    async (windowId: string, filePath: string) => {
      const didSave = await saveFileWindowForWorktree({
        sessionStore: getWorkspaceSessionStore(),
        worktreeId: activeWorktreeId,
        windowId,
        filePath,
        writeFile: (nextFilePath, content) =>
          window.piDesktop.fs.writeFile(nextFilePath, content),
      }).then(
        (result) => result,
        (error) => {
          toast.error("Failed to save file", {
            description: getErrorDescription(
              error,
              "The file could not be written to disk",
            ),
          });
          return false;
        },
      );
      if (didSave) {
        windowStore.setDirty(windowId, false);
      }
    },
    [activeWorktreeId, windowStore],
  );

  const handleAddRepository = React.useCallback(async () => {
    const paths = await window.piDesktop.dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add Repository",
    });
    if (!paths || paths.length === 0) {
      return;
    }

    let addedCount = 0;

    for (const repositoryPath of paths) {
      const repositoryName =
        repositoryPath
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? repositoryPath;

      const isRepo = await window.piDesktop.git.isRepository(repositoryPath);

      if (!isRepo) {
        setInitGitRepoPath(repositoryPath);
        setInitGitRepoName(repositoryName);
        setInitGitRepoOpen(true);
        // Don't process remaining paths — resume after user decides on init.
        break;
      }

      try {
        await window.piDesktop.repositories.add(repositoryPath);
        addedCount += 1;
      } catch (error) {
        toast.error("Invalid repository", {
          description:
            error instanceof Error
              ? error.message
              : "The selected directory is not a valid git repository",
        });
      }
    }

    if (addedCount > 0) {
      await reload();
    }

    if (addedCount === 1) {
      toast.success("Workspace added");
    } else if (addedCount > 1) {
      toast.success("Workspaces added", {
        description: `${addedCount} projects are now available in the rail`,
      });
    }
  }, [reload, setInitGitRepoOpen]);

  const handleSelectRepository = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        return;
      }

      setSelectedContextSurface(null);
      await window.piDesktop.repositories.select(repositoryId);
    },
    [repositories],
  );

  const handleRemoveRepository = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        return;
      }

      setConfirmRemoveRepositoryId(repositoryId);
      setConfirmRemoveRepositoryName(repository.customName ?? repository.name);
      setRemoveRepositoryError(null);
      setRemoveRepositoryOpen(true);
    },
    [repositories, setRemoveRepositoryOpen],
  );

  const handleCopyRepositoryPath = React.useCallback(
    async (repositoryId: string) => {
      const repository = repositories.find(
        (entry) => entry.id === repositoryId,
      );
      if (!repository) {
        return;
      }

      await navigator.clipboard.writeText(repository.rootPath);
      toast.success("Path copied");
    },
    [repositories],
  );

  const handleOpenInFinder = React.useCallback(async (repositoryId: string) => {
    await window.piDesktop.repositories.openInFinder(repositoryId);
    toast.success("Opened in Finder");
  }, []);

  const submitCreateWorktree = React.useCallback(async () => {
    let branchName = newWorktreeBranch.trim();
    if (!branchName) {
      branchName = `session/${createThreadTitle().toLowerCase()}`;
    }

    let repositoryId = activeRepositoryId;
    if (!repositoryId) {
      const freshShell = await window.piDesktop.shell.getSnapshot();
      repositoryId = getActiveRepository(freshShell)?.id ?? null;
    }

    if (!repositoryId) {
      return;
    }

    try {
      await window.piDesktop.worktrees.create(repositoryId, branchName);
      setCreateWorktreeOpen(false);
      setNewWorktreeBranchState("");
      setWorktreeCreateError(null);
      toast.success("Session created");
    } catch (error) {
      setWorktreeCreateError(
        error instanceof Error ? error.message : "Failed to create worktree",
      );
    }
  }, [activeRepositoryId, newWorktreeBranch, setCreateWorktreeOpen]);

  const handleSelectWorktree = React.useCallback(async (worktreeId: string) => {
    await window.piDesktop.worktrees.select(worktreeId);
  }, []);

  const handleCreateSession = React.useCallback(() => {
    setCreateWorktreeOpen(true);
  }, [setCreateWorktreeOpen]);

  const handleCreateThread = React.useCallback(async (worktreeId: string) => {
    const threadId = await window.piDesktop.threads.create(worktreeId);
    setSelectedContextSurface(null);
    return threadId;
  }, []);

  const submitRemoveRepository = React.useCallback(async () => {
    if (!confirmRemoveRepositoryId) {
      return;
    }

    try {
      await window.piDesktop.repositories.remove(confirmRemoveRepositoryId);
      setRemoveRepositoryOpen(false);
      setConfirmRemoveRepositoryId(null);
      setConfirmRemoveRepositoryName(null);
      setRemoveRepositoryError(null);
      toast.success("Project removed");
      await reload();
    } catch (error) {
      setRemoveRepositoryError(
        error instanceof Error ? error.message : "Failed to remove repository",
      );
    }
  }, [confirmRemoveRepositoryId, reload, setRemoveRepositoryOpen]);

  const submitInitGitRepo = React.useCallback(async () => {
    if (!initGitRepoPath || !initGitRepoName) {
      return;
    }

    try {
      await window.piDesktop.git.init(initGitRepoPath);
      await window.piDesktop.repositories.add(initGitRepoPath);
      setInitGitRepoOpen(false);
      await reload();
      toast.success("Git repository initialized");
    } catch (error) {
      toast.error("Failed to initialize git repository", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [initGitRepoName, initGitRepoPath, reload, setInitGitRepoOpen]);

  const skipInitGitRepo = React.useCallback(async () => {
    if (!initGitRepoPath) {
      setInitGitRepoOpen(false);
      return;
    }

    try {
      await window.piDesktop.repositories.add(initGitRepoPath);
      await reload();
    } catch {
      // non-repo folder handled by main process
    }
    setInitGitRepoOpen(false);
  }, [initGitRepoPath, reload, setInitGitRepoOpen]);

  const handleCloseThread = React.useCallback(
    async (threadId: string) => {
      if (activeThreadId === threadId) {
        const otherThreads = activeWorktree?.threads.filter(
          (t) => t.id !== threadId,
        );
        if (otherThreads && otherThreads.length > 0 && otherThreads[0]) {
          await window.piDesktop.threads.select(otherThreads[0].id);
        } else {
          setSelectedContextSurface(null);
        }
      }
      await window.piDesktop.threads.delete(threadId);
    },
    [activeThreadId, activeWorktree],
  );

  const handleDeleteThread = React.useCallback(
    async (threadId: string) => {
      await window.piDesktop.threads.delete(threadId);
      if (activeThreadId === threadId) {
        setSelectedContextSurface(null);
      }
    },
    [activeThreadId],
  );

  const handleDeleteWorktree = React.useCallback(
    async (worktreeId: string) => {
      await window.piDesktop.worktrees.remove(worktreeId);
      if (activeWorktreeId === worktreeId) {
        setSelectedContextSurface(null);
      }
    },
    [activeWorktreeId],
  );

  const handleSelectThread = React.useCallback(async (threadId: string) => {
    setSelectedContextSurface(null);
    await window.piDesktop.threads.select(threadId);
  }, []);

  const autocompleteMatch = React.useMemo(
    () => getPromptAutocompleteMatch(draft),
    [draft],
  );

  React.useEffect(() => {
    let disposed = false;

    async function loadAutocomplete() {
      if (!autocompleteMatch) {
        clearAutocomplete();
        return;
      }

      try {
        const suggestions = await loadPromptAutocompleteSuggestions({
          draft,
          autocompleteMatch,
          activeWorktreePath,
          windows: windowState.layout.windows,
          getSlashSuggestions: (args) =>
            window.piDesktop.agent.getSlashSuggestions(args),
          searchFiles: (args) => window.piDesktop.search.searchFiles(args),
        });

        if (!disposed) {
          setAutocompleteSuggestions(suggestions);
        }
      } catch (error) {
        console.error("Failed to load prompt autocomplete suggestions:", error);
        if (!disposed) {
          clearAutocomplete();
        }
      }
    }

    void loadAutocomplete();

    return () => {
      disposed = true;
    };
  }, [
    autocompleteMatch,
    activeWorktreePath,
    clearAutocomplete,
    draft,
    setAutocompleteSuggestions,
    windowState.layout.windows,
  ]);

  const handleAutocompleteSelect = React.useCallback(
    (suggestion: SlashSuggestion | MentionSuggestion) => {
      if (!autocompleteMatch) {
        return;
      }

      let replacement = "";
      if (suggestion.kind === "skill" || suggestion.kind === "command") {
        replacement = `${suggestion.slash} `;
      } else if (suggestion.kind === "terminal") {
        replacement = buildTerminalMention(suggestion.id);
      } else if (suggestion.kind === "file") {
        replacement = buildFileMention(suggestion.id);
      } else {
        replacement = `${suggestion.name} `;
      }

      setDraft(replacePromptToken(draft, autocompleteMatch, replacement));
      clearAutocomplete();
    },
    [autocompleteMatch, clearAutocomplete, draft, setDraft],
  );

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!autocompleteMatch || autocompleteSuggestions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setAutocompleteSelectedIndex(
          autocompleteSelectedIndex < autocompleteSuggestions.length - 1
            ? autocompleteSelectedIndex + 1
            : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setAutocompleteSelectedIndex(
          autocompleteSelectedIndex > 0
            ? autocompleteSelectedIndex - 1
            : autocompleteSuggestions.length - 1,
        );
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        const selectedSuggestion =
          autocompleteSelectedIndex >= 0
            ? autocompleteSuggestions[autocompleteSelectedIndex]
            : undefined;
        if (selectedSuggestion) {
          event.preventDefault();
          handleAutocompleteSelect(selectedSuggestion);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearAutocomplete();
      }
    },
    [
      autocompleteMatch,
      autocompleteSelectedIndex,
      autocompleteSuggestions,
      clearAutocomplete,
      handleAutocompleteSelect,
      setAutocompleteSelectedIndex,
    ],
  );

  const handleModelSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selection = parseModelSelectionValue(event.target.value);
      if (!selection) {
        return;
      }

      await switchModel(selection).then(undefined, (error) => {
        toast.error("Failed to switch model", {
          description: getErrorDescription(
            error,
            "The selected model could not be activated",
          ),
        });
      });
    },
    [switchModel],
  );

  const favoriteModels = React.useMemo(
    () => appPreferences.favoriteModels ?? [],
    [appPreferences.favoriteModels],
  );

  const handleToggleFavorite = React.useCallback(
    (modelValue: string) => {
      const current = appPreferences.favoriteModels ?? [];
      const next = current.includes(modelValue)
        ? current.filter((v) => v !== modelValue)
        : [...current, modelValue];
      void updateAppPreferences({ favoriteModels: next });
    },
    [appPreferences.favoriteModels, updateAppPreferences],
  );

  const handleSend = React.useCallback(async () => {
    const oauthCommand = parseOAuthChatCommand(draft);
    if (oauthCommand) {
      setDraft("");
      if (oauthCommand.action === "providers") {
        await openOAuthDialog("providers", null);
        return;
      }

      await openOAuthDialog(oauthCommand.action, oauthCommand.providerId);
      return;
    }

    if (!canSend || !activeThreadId) {
      return;
    }

    setPendingPromptThreadId(activeThreadId);
    void sendPrompt();
  }, [activeThreadId, canSend, draft, openOAuthDialog, sendPrompt, setDraft]);

  const handlePromptModeChange = React.useCallback(
    (nextMode: PromptMode) => {
      setPromptMode(nextMode);
      const normalizedDraft = stripPromptModePrefix(draft).trimStart();
      const prefix = PROMPT_MODE_TO_PREFIX[nextMode];
      setDraft(
        `${prefix}${normalizedDraft}`.trimEnd() + (normalizedDraft ? "" : ""),
      );
    },
    [draft, setDraft],
  );

  const handleCancelPrompt = React.useCallback(async () => {
    setPendingPromptThreadId(null);
    await cancelPrompt();
  }, [cancelPrompt]);

  const handleAgentGitAction = React.useCallback(
    (prompt: string) => {
      if (
        !activeThreadId ||
        agent.status === "starting" ||
        agent.status === "streaming"
      ) {
        return;
      }
      setDraft(prompt);
      setPendingPromptThreadId(activeThreadId);
      void sendPrompt();
    },
    [activeThreadId, agent.status, sendPrompt, setDraft],
  );

  const runtimeMode = shell.runtime?.agentMode ?? "unknown";
  const runtimeModeLabel = `${runtimeMode} mode`;
  const displayAgentStatus = agent.status;
  const currentModelValue = React.useMemo(
    () => resolveCurrentModelValue(providerSnapshots, settingsSnapshot),
    [providerSnapshots, settingsSnapshot],
  );
  const handleModelMenuOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        return;
      }

      void reload();
    },
    [reload],
  );

  const contextWindows = React.useMemo(
    () =>
      windowState.layout.windows.filter(
        (window): window is WorkspaceShellProps["contextWindows"][number] =>
          window.kind === "file" ||
          window.kind === "terminal" ||
          window.kind === "git",
      ),
    [windowState.layout.windows],
  );
  React.useEffect(() => {
    const noteWindows = windowState.layout.windows.filter(
      (window) => window.kind === "note",
    );

    if (noteWindows.length === 0) {
      return;
    }

    noteWindows.forEach((window) => {
      windowStore.closeWindow(window.id);
    });
  }, [windowState.layout.windows, windowStore]);

  React.useEffect(() => {
    setSelectedContextSurface((current) =>
      getInitialContextSurface(contextWindows, current),
    );
  }, [contextWindows]);

  React.useEffect(() => {
    const terminalAndGitWindows = contextWindows.filter(
      (window) => window.kind === "terminal" || window.kind === "git",
    );
    terminalAndGitWindows.forEach((window) => {
      windowStore.closeWindow(window.id);
    });
  }, [contextWindows, windowStore]);

  const handleSelectContextSurface = React.useCallback(
    (surfaceKey: WorkspaceShellProps["selectedContextSurface"]) => {
      if (surfaceKey === selectedContextSurface) {
        setSelectedContextSurface(null);
        return;
      }
      setSelectedContextSurface(surfaceKey);
      if (surfaceKey && surfaceKey !== "activity") {
        windowStore.focusWindow(surfaceKey);
      }
    },
    [selectedContextSurface, windowStore],
  );

  const handleCloseFileWindow = React.useCallback(
    (windowId: string) => {
      const fileWindows = contextWindows.filter(
        (
          window,
        ): window is Extract<
          (typeof contextWindows)[number],
          { kind: "file" }
        > => window.kind === "file",
      );
      const closingIndex = fileWindows.findIndex(
        (window) => window.id === windowId,
      );
      const nextFileWindow =
        closingIndex >= 0
          ? (fileWindows[closingIndex + 1] ??
            fileWindows[closingIndex - 1] ??
            null)
          : null;

      windowStore.closeWindow(windowId);

      if (selectedContextSurface !== windowId) {
        return;
      }

      setSelectedContextSurface(nextFileWindow?.id ?? null);
    },
    [contextWindows, selectedContextSurface, windowStore],
  );

  const handleLeftSidebarResize = React.useCallback((width: number) => {
    setLeftSidebarWidth(width);
  }, []);

  const handleFileTreeFileSelect = React.useCallback(
    (filePath: string) => {
      if (!activeWorktreeId) return;

      // Check for existing window (sync path)
      const existingFileWindow = windowState.layout.windows.find(
        (w): w is Extract<typeof w, { kind: "file" }> =>
          w.kind === "file" && w.filePath === filePath,
      );

      if (existingFileWindow) {
        windowStore.focusWindow(existingFileWindow.id);
        setSelectedContextSurface(existingFileWindow.id);
        return;
      }

      const createdWindow = windowStore.createWindow(
        { kind: "file", filePath },
        activeWorktreePath ?? undefined,
      );
      setSelectedContextSurface(createdWindow.id);

      // Set loading state and read content async
      getWorkspaceSessionStore()
        .getState()
        .setFileContentForWorktree(activeWorktreeId, createdWindow.id, {
          content: null,
          isLoading: true,
          error: null,
        });

      window.piDesktop.fs.readFile(filePath).then(
        (result) => {
          getWorkspaceSessionStore()
            .getState()
            .setFileContentForWorktree(activeWorktreeId, createdWindow.id, {
              content: result,
              isLoading: false,
              error: null,
            });
        },
        (error) => {
          getWorkspaceSessionStore()
            .getState()
            .setFileContentForWorktree(activeWorktreeId, createdWindow.id, {
              content: null,
              isLoading: false,
              error:
                error instanceof Error ? error.message : "Failed to load file",
            });
        },
      );
    },
    [
      activeWorktreeId,
      activeWorktreePath,
      windowStore,
      windowState.layout.windows,
    ],
  );

  const handleFileTreeDeleteFile = React.useCallback(async (path: string) => {
    await window.piDesktop.fs.deleteFile(path);
    toast.success("Deleted", { description: path.split("/").pop() });
  }, []);

  const handleFileTreeRenameFile = React.useCallback(
    async (oldPath: string, newPath: string) => {
      await window.piDesktop.fs.renameFile(oldPath, newPath);
      toast.success("Renamed", { description: newPath.split("/").pop() });
    },
    [],
  );

  const handleFileTreeMoveFile = React.useCallback(
    async (source: string, destination: string) => {
      await window.piDesktop.fs.moveFile(source, destination);
      toast.success("Moved", { description: source.split("/").pop() });
    },
    [],
  );

  const handleConnectProvider = React.useCallback(() => {
    void openOAuthDialog("providers", null);
  }, [openOAuthDialog]);

  const activeThreadTitle = activeThread
    ? getThreadWindowTitle(activeThread)
    : null;
  const threadMessages = activeThreadConversation?.messages ?? agent.messages;
  const threadLastError =
    activeThreadConversation?.lastError ?? agent.lastError;
  const shellGit = shell.git ?? null;
  const contextUsage = agent.contextUsage;

  const workspaceShellProps: WorkspaceShellProps = React.useMemo(
    () => ({
      platform,
      repositories,
      activeRepository,
      activeRepositoryId,
      activeWorktreeId,
      activeThreadId,
      activeThreadTitle,
      draft,
      canSend,
      autocompleteSuggestions,
      autocompleteSelectedIndex,
      displayAgentStatus,
      runtimeModeLabel,
      providerSnapshots,
      currentModelValue,
      contextUsage,
      isSwitchingModel,
      isPromptVisible,
      isPromptExecuting,
      activeGitRepositoryStatus,
      shellGit,
      gitCommitMessage,
      threadMessages,
      threadLastError,
      contextWindows,
      selectedContextSurface,
      leftSidebarWidth,
      onSelectContextSurface: handleSelectContextSurface,
      onCloseFileWindow: handleCloseFileWindow,
      onLeftSidebarResize: handleLeftSidebarResize,
      onModelMenuOpenChange: handleModelMenuOpenChange,
      onAddRepository: handleAddRepository,
      onSelectRepository: handleSelectRepository,
      onRemoveRepository: handleRemoveRepository,
      onCopyRepositoryPath: handleCopyRepositoryPath,
      onOpenInFinder: handleOpenInFinder,
      onCreateSession: handleCreateSession,
      onSelectWorktree: handleSelectWorktree,
      onSelectThread: handleSelectThread,
      onCreateThread: handleCreateThread,
      onCloseThread: handleCloseThread,
      onDeleteThread: handleDeleteThread,
      onDeleteWorktree: handleDeleteWorktree,
      onOpenGit: handleOpenGit,
      onToggleTerminal: handleToggleTerminal,
      isTerminalVisible,
      onGitCommitMessageChange: setGitCommitMessage,
      onRefreshGit: refreshGitRepositoryStatus,
      onCommitGit: commitGitChanges,
      onCommitAndPushGit: commitAndPushGitChanges,
      onPullGit: pullGitChanges,
      onPushGit: pushGitChanges,
      onFetchGit: fetchGitChanges,
      onStageGitFile: stageGitFile,
      onStageAllGitFiles: stageAllGitFiles,
      onUnstageGitFile: unstageGitFile,
      onUnstageAllGitFiles: unstageAllGitFiles,
      onDiscardGitFile: discardGitFile,
      onFileContentChange: handleFileContentChange,
      onFileSave: handleFileSave,
      onDraftChange: setDraft,
      onSend: handleSend,
      onCancelPrompt: handleCancelPrompt,
      onAutocompleteSelect: handleAutocompleteSelect,
      onAutocompleteHover: setAutocompleteSelectedIndex,
      onPromptKeyDown: handlePromptKeyDown,
      onModelSelection: handleModelSelection,
      promptMode,
      onPromptModeChange: handlePromptModeChange,
      onConnectProvider: handleConnectProvider,
      favoriteModels,
      onToggleFavorite: handleToggleFavorite,
      workspacePath: activeWorktreePath,
      onFileTreeFileSelect: handleFileTreeFileSelect,
      onFileTreeDeleteFile: handleFileTreeDeleteFile,
      onFileTreeRenameFile: handleFileTreeRenameFile,
      onFileTreeMoveFile: handleFileTreeMoveFile,
      onAgentGitAction: handleAgentGitAction,
    }),
    [
      platform,
      repositories,
      activeRepository,
      activeRepositoryId,
      activeWorktreeId,
      activeThreadId,
      activeThreadTitle,
      draft,
      canSend,
      autocompleteSuggestions,
      autocompleteSelectedIndex,
      displayAgentStatus,
      runtimeModeLabel,
      providerSnapshots,
      currentModelValue,
      contextUsage,
      isSwitchingModel,
      isPromptVisible,
      isPromptExecuting,
      activeGitRepositoryStatus,
      shellGit,
      gitCommitMessage,
      threadMessages,
      threadLastError,
      contextWindows,
      selectedContextSurface,
      leftSidebarWidth,
      handleSelectContextSurface,
      handleCloseFileWindow,
      handleLeftSidebarResize,
      handleModelMenuOpenChange,
      handleAddRepository,
      handleSelectRepository,
      handleRemoveRepository,
      handleCopyRepositoryPath,
      handleOpenInFinder,
      handleCreateSession,
      handleSelectWorktree,
      handleSelectThread,
      handleCreateThread,
      handleCloseThread,
      handleDeleteThread,
      handleDeleteWorktree,
      handleOpenGit,
      handleToggleTerminal,
      isTerminalVisible,
      refreshGitRepositoryStatus,
      commitGitChanges,
      commitAndPushGitChanges,
      pullGitChanges,
      pushGitChanges,
      fetchGitChanges,
      stageGitFile,
      stageAllGitFiles,
      unstageGitFile,
      unstageAllGitFiles,
      discardGitFile,
      handleFileContentChange,
      handleFileSave,
      setDraft,
      handleSend,
      handleCancelPrompt,
      handleAutocompleteSelect,
      setAutocompleteSelectedIndex,
      handlePromptKeyDown,
      handleModelSelection,
      promptMode,
      handlePromptModeChange,
      handleConnectProvider,
      favoriteModels,
      handleToggleFavorite,
      activeWorktreePath,
      handleFileTreeFileSelect,
      handleFileTreeDeleteFile,
      handleFileTreeRenameFile,
      handleFileTreeMoveFile,
      handleAgentGitAction,
    ],
  );

  return {
    workspaceShellProps,
    oauthDialogState: {
      open: oauthDialogOpen,
      mode: oauthDialogMode,
      providers: oauthProviders,
      requestedProviderId: oauthRequestedProviderId,
      isBusy: isOAuthBusy,
    },
    setOAuthDialogOpen,
    submitOAuthDialog,
    activeGitRepositoryStatus,
    gitCommitMessage,
    setGitCommitMessage,
    refreshGitRepositoryStatus,
    stageGitFile,
    stageAllGitFiles,
    unstageGitFile,
    unstageAllGitFiles,
    discardGitFile,
    commitGitChanges,
    commitAndPushGitChanges,
    pullGitChanges,
    pushGitChanges,
    fetchGitChanges,
    isCreateWorktreeOpen,
    setCreateWorktreeOpen,
    confirmRemoveRepositoryName,
    isRemoveRepositoryOpen,
    setRemoveRepositoryOpen,
    removeRepositoryError,
    submitRemoveRepository,
    newWorktreeBranch,
    setNewWorktreeBranch: setNewWorktreeBranchState,
    worktreeCreateError,
    submitCreateWorktree,
    isInitGitRepoOpen,
    setInitGitRepoOpen,
    initGitRepoPath,
    initGitRepoName,
    submitInitGitRepo,
    skipInitGitRepo,
    onAgentGitAction: handleAgentGitAction,
  };
}
