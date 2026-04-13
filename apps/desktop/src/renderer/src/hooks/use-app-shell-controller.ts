import type {
  GitRepositoryStatus,
  MentionSuggestion,
  SlashSuggestion,
  ThreadSnapshot,
} from "@pidesk/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pidesk/shared";
import * as React from "react";
import { useStore } from "zustand";
import { DEFAULT_UNTITLED_THREAD_TITLE } from "../../../thread-title-defaults";
import type { WorkspaceShellProps } from "../components/workspace/workspace-shell";
import { loadPromptAutocompleteSuggestions } from "../lib/prompt-autocomplete-loader";
import {
  buildFileMention,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  replacePromptToken,
} from "../lib/prompt-routing";
import { toast } from "../lib/toast";
import { uiInteractionStore } from "../stores/ui-interaction-store";
import {
  openFileWindowForWorktree,
  saveFileWindowForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
} from "../stores/workspace-session-runtime";
import { selectThreadConversationByWorktree } from "../stores/workspace-session-selectors";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
  useShellModel,
} from "./use-shell-model";
import { useWindowStore, workspaceSessionStore } from "./use-window-store";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];

function getErrorDescription(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
const PENDING_SURFACE_PREFIX = "__pending_surface__";
const WORKSPACE_SWITCH_STATE_KEY = "pidesk.workspace-switch-state";

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

export interface AppShellController {
  workspaceShellProps: WorkspaceShellProps;
  workspaceSwitchingRepositoryName: string | null;
  activeGitRepositoryStatus: GitRepositoryStatus | null;
  gitCommitMessage: string;
  setGitCommitMessage: (value: string) => void;
  refreshGitRepositoryStatus: () => Promise<void>;
  stageGitFile: (filePath: string) => Promise<void>;
  unstageGitFile: (filePath: string) => Promise<void>;
  discardGitFile: (filePath: string) => Promise<void>;
  commitGitChanges: () => Promise<void>;
  pullGitChanges: () => Promise<void>;
  pushGitChanges: () => Promise<void>;
  isPackagesOpen: boolean;
  setPackagesOpen: (isOpen: boolean) => void;
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
    updateRepositoryPreferences,
  } = useShellModel();
  const { agent, draft, live, shell } = state;
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
    workspaceSessionStore.subscribe,
    () =>
      activeThreadId
        ? selectThreadConversationByWorktree(
            workspaceSessionStore.getState(),
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
  const isFileTreeOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.fileTree.isOpen,
  );
  const isPackagesOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.packages,
  );
  const isCreateWorktreeOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.createWorktree,
  );
  const isRemoveRepositoryOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.confirmRemoveRepository,
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
  const [selectedContextSurface, setSelectedContextSurface] =
    React.useState<WorkspaceShellProps["selectedContextSurface"]>(null);
  const [leftRailWidth, setLeftRailWidth] = React.useState(260);
  const [promptMode, setPromptMode] = React.useState<PromptMode>(() =>
    detectPromptMode(draft),
  );
  const [activeGitRepositoryStatus, setActiveGitRepositoryStatus] =
    React.useState<GitRepositoryStatus | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = React.useState("");
  const [
    workspaceSwitchingRepositoryName,
    setWorkspaceSwitchingRepositoryName,
  ] = React.useState<string | null>(null);

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
  const setPackagesOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("packages", isOpen);
  }, []);
  const setCreateWorktreeOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("createWorktree", isOpen);
  }, []);
  const setRemoveRepositoryOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore
      .getState()
      .setDialogOpen("confirmRemoveRepository", isOpen);
  }, []);
  const closeFileTreeOverlay = React.useCallback(() => {
    uiInteractionStore.getState().closeFileTreeOverlay();
  }, []);

  React.useEffect(() => {
    setPromptMode(detectPromptMode(draft));
  }, [draft]);

  React.useEffect(() => {
    syncActiveThreadConversation({
      sessionStore: workspaceSessionStore,
      worktreeId: activeWorktreeId,
      threadId: activeThreadId,
      conversation: {
        messages: agent.messages,
        status: agent.status,
        lastError: agent.lastError,
      },
    });
  }, [
    activeWorktreeId,
    activeThreadId,
    agent.lastError,
    agent.messages,
    agent.status,
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
  const isPromptExecuting =
    activeThreadConversation?.status === "starting" ||
    activeThreadConversation?.status === "streaming";
  const isPromptVisible = activeThreadId !== null;

  const handleFileClick = React.useCallback(
    async (filePath: string) => {
      setSelectedContextSurface(`${PENDING_SURFACE_PREFIX}:file`);
      const createdWindowId = await openFileWindowForWorktree({
        sessionStore: workspaceSessionStore,
        windowActions: {
          createWindow: windowStore.createWindow,
          focusWindow: windowStore.focusWindow,
        },
        windows: windowState.layout.windows,
        worktreeId: activeWorktreeId,
        worktreePath: activeWorktreePath,
        filePath,
        readFile: (nextFilePath) => window.pidesk.fs.readFile(nextFilePath),
      });
      setSelectedContextSurface(createdWindowId);
      closeFileTreeOverlay();
    },
    [
      activeWorktreeId,
      activeWorktreePath,
      closeFileTreeOverlay,
      windowState.layout.windows,
      windowStore,
    ],
  );

  const handleOpenTerminal = React.useCallback(() => {
    const existingTerminal = windowState.layout.windows.find(
      (
        window,
      ): window is Extract<
        (typeof windowState.layout.windows)[number],
        { kind: "terminal" }
      > => window.kind === "terminal" && window.backend === "shell",
    );
    if (existingTerminal) {
      if (existingTerminal.id === selectedContextSurface) {
        setSelectedContextSurface(null);
        return;
      }
      windowStore.focusWindow(existingTerminal.id);
      setSelectedContextSurface(existingTerminal.id);
      return;
    }

    const terminalWindow = windowStore.createWindow(
      {
        kind: "terminal",
        backend: "shell",
        cwd: activeWorktreePath ?? undefined,
      },
      activeWorktreePath ?? undefined,
    );
    setSelectedContextSurface(terminalWindow.id);
  }, [
    activeWorktreePath,
    selectedContextSurface,
    windowState.layout.windows,
    windowStore,
  ]);

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
      await window.pidesk.git.getRepositoryStatus(activeWorktreePath);
    setActiveGitRepositoryStatus(status);
  }, [activeWorktreePath]);

  React.useEffect(() => {
    let disposed = false;

    if (!activeWorktreePath) {
      setActiveGitRepositoryStatus(null);
      return;
    }

    void window.pidesk.git
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
        () => window.pidesk.git.stageFile(activeWorktreePath, filePath),
        "File staged",
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
        () => window.pidesk.git.unstageFile(activeWorktreePath, filePath),
        "File unstaged",
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
        () => window.pidesk.git.discardFile(activeWorktreePath, filePath),
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
      const status = await window.pidesk.git.commit(
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

  const pullGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.pidesk.git.pull(activeWorktreePath),
      "Repository updated",
    );
  }, [activeWorktreePath, runGitMutation]);

  const pushGitChanges = React.useCallback(async () => {
    if (!activeWorktreePath) {
      return;
    }

    await runGitMutation(
      () => window.pidesk.git.push(activeWorktreePath),
      "Changes pushed",
    );
  }, [activeWorktreePath, runGitMutation]);

  const handleFileContentChange = React.useCallback(
    (windowId: string, newContent: string) => {
      updateFileDraftForWorktree({
        sessionStore: workspaceSessionStore,
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
        sessionStore: workspaceSessionStore,
        worktreeId: activeWorktreeId,
        windowId,
        filePath,
        writeFile: (nextFilePath, content) =>
          window.pidesk.fs.writeFile(nextFilePath, content),
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
    const paths = await window.pidesk.dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add Repository",
    });
    if (!paths || paths.length === 0) {
      return;
    }
    for (const repositoryPath of paths) {
      const repositoryName =
        repositoryPath
          .split(/[\\/]+/)
          .filter(Boolean)
          .pop() ?? repositoryPath;

      setWorkspaceSwitchingRepositoryName(repositoryName);

      try {
        await window.pidesk.repositories.add(repositoryPath);
        return;
      } catch (error) {
        toast.error("Invalid repository", {
          description:
            error instanceof Error
              ? error.message
              : "The selected directory is not a valid git repository",
        });
        return;
      }
    }
  }, []);

  const handleRenameRepository = React.useCallback(
    async (repositoryId: string, name: string) => {
      await updateRepositoryPreferences(repositoryId, {
        customName: name.trim().length > 0 ? name.trim() : null,
      });
    },
    [updateRepositoryPreferences],
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
    await window.pidesk.repositories.openInFinder(repositoryId);
    toast.success("Opened in Finder");
  }, []);

  const submitCreateWorktree = React.useCallback(async () => {
    if (!newWorktreeBranch.trim()) {
      return;
    }

    let repositoryId = activeRepositoryId;
    if (!repositoryId) {
      const freshShell = await window.pidesk.shell.getSnapshot();
      repositoryId = getActiveRepository(freshShell)?.id ?? null;
    }

    if (!repositoryId) {
      return;
    }

    try {
      await window.pidesk.worktrees.create(
        repositoryId,
        newWorktreeBranch.trim(),
      );
      setCreateWorktreeOpen(false);
      setNewWorktreeBranchState("");
      setWorktreeCreateError(null);
      toast.success("Worktree created");
    } catch (error) {
      setWorktreeCreateError(
        error instanceof Error ? error.message : "Failed to create worktree",
      );
    }
  }, [activeRepositoryId, newWorktreeBranch, setCreateWorktreeOpen]);

  const handleSelectWorktree = React.useCallback(
    async (worktreeId: string) => {
      const repositoryName =
        activeRepository?.customName?.trim() ||
        activeRepository?.name ||
        "Workspace";

      setWorkspaceSwitchingRepositoryName(repositoryName);
      await window.pidesk.worktrees.select(worktreeId);
    },
    [activeRepository?.customName, activeRepository?.name],
  );

  const handleCreateThread = React.useCallback(async (worktreeId: string) => {
    const threadId = await window.pidesk.threads.create(worktreeId);
    setSelectedContextSurface(null);
    return threadId;
  }, []);

  const submitRemoveRepository = React.useCallback(async () => {
    if (!confirmRemoveRepositoryId) {
      return;
    }

    try {
      await window.pidesk.repositories.remove(confirmRemoveRepositoryId);
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

  const handleCloseThread = React.useCallback(
    async (threadId: string) => {
      await window.pidesk.threads.archive(threadId);
      if (activeThreadId === threadId) {
        setSelectedContextSurface(null);
      }
    },
    [activeThreadId],
  );

  const handleDeleteThread = React.useCallback(
    async (threadId: string) => {
      await window.pidesk.threads.delete(threadId);
      if (activeThreadId === threadId) {
        setSelectedContextSurface(null);
      }
    },
    [activeThreadId],
  );

  const handleSelectThread = React.useCallback(async (threadId: string) => {
    setSelectedContextSurface(null);
    await window.pidesk.threads.select(threadId);
  }, []);

  React.useEffect(() => {
    if (!workspaceSwitchingRepositoryName) {
      return;
    }

    sessionStorage.setItem(
      WORKSPACE_SWITCH_STATE_KEY,
      JSON.stringify({
        repositoryName: workspaceSwitchingRepositoryName,
        startedAt: Date.now(),
      }),
    );
  }, [workspaceSwitchingRepositoryName]);

  React.useEffect(() => {
    if (!workspaceSwitchingRepositoryName) {
      return;
    }

    const nextRepositoryName =
      activeRepository?.customName?.trim() || activeRepository?.name || null;

    if (!nextRepositoryName) {
      return;
    }

    if (nextRepositoryName !== workspaceSwitchingRepositoryName) {
      return;
    }

    setWorkspaceSwitchingRepositoryName(null);
  }, [
    activeRepository?.customName,
    activeRepository?.name,
    workspaceSwitchingRepositoryName,
  ]);

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
            window.pidesk.agent.getSlashSuggestions(args),
          searchFiles: (args) => window.pidesk.search.searchFiles(args),
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

  const handleSend = React.useCallback(async () => {
    if (!canSend || !activeThreadId) {
      return;
    }

    void sendPrompt();
  }, [activeThreadId, canSend, sendPrompt]);

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
    await cancelPrompt();
  }, [cancelPrompt]);

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
    if (selectedContextSurface === null) {
      contextWindows.forEach((window) => {
        windowStore.closeWindow(window.id);
      });
      return;
    }

    if (selectedContextSurface === "activity") {
      contextWindows.forEach((window) => {
        windowStore.closeWindow(window.id);
      });
      return;
    }

    if (selectedContextSurface?.startsWith(PENDING_SURFACE_PREFIX)) {
      return;
    }

    const hasSelectedWindow = contextWindows.some(
      (window) => window.id === selectedContextSurface,
    );
    if (!hasSelectedWindow) {
      return;
    }

    contextWindows.forEach((window) => {
      if (window.id !== selectedContextSurface) {
        windowStore.closeWindow(window.id);
      }
    });
  }, [contextWindows, selectedContextSurface, windowStore]);

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

  const handleLeftRailResize = React.useCallback((width: number) => {
    setLeftRailWidth(width);
  }, []);

  const workspaceShellProps: WorkspaceShellProps = {
    platform,
    repositories,
    activeRepository,
    activeRepositoryId,
    activeWorktreeId,
    activeThreadId,
    activeThreadTitle: activeThread ? getThreadWindowTitle(activeThread) : null,
    draft,
    canSend,
    autocompleteSuggestions,
    autocompleteSelectedIndex,
    displayAgentStatus,
    runtimeModeLabel,
    providerSnapshots,
    currentModelValue,
    isSwitchingModel,
    isFileTreeOpen,
    isPromptVisible,
    isPromptExecuting,
    activeGitRepositoryStatus,
    shellGit: shell.git ?? null,
    gitCommitMessage,
    threadMessages: activeThreadConversation?.messages ?? agent.messages,
    threadLastError: activeThreadConversation?.lastError ?? agent.lastError,
    liveFeed: live,
    contextWindows,
    selectedContextSurface,
    leftRailWidth,
    onSelectContextSurface: handleSelectContextSurface,
    onLeftRailResize: handleLeftRailResize,
    onModelMenuOpenChange: handleModelMenuOpenChange,
    onAddRepository: handleAddRepository,
    onUpdateRepositoryPreferences: updateRepositoryPreferences,
    onRenameRepository: handleRenameRepository,
    onRemoveRepository: handleRemoveRepository,
    onCopyRepositoryPath: handleCopyRepositoryPath,
    onOpenInFinder: handleOpenInFinder,
    onSelectWorktree: handleSelectWorktree,
    onSelectThread: handleSelectThread,
    onCreateThread: handleCreateThread,
    onCloseThread: handleCloseThread,
    onDeleteThread: handleDeleteThread,
    onCloseFileTree: closeFileTreeOverlay,
    onOpenGit: handleOpenGit,
    onOpenTerminal: handleOpenTerminal,
    onGitCommitMessageChange: setGitCommitMessage,
    onRefreshGit: refreshGitRepositoryStatus,
    onCommitGit: commitGitChanges,
    onPullGit: pullGitChanges,
    onPushGit: pushGitChanges,
    onStageGitFile: stageGitFile,
    onUnstageGitFile: unstageGitFile,
    onDiscardGitFile: discardGitFile,
    onFileClick: handleFileClick,
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
  };

  return {
    workspaceShellProps,
    workspaceSwitchingRepositoryName,
    activeGitRepositoryStatus,
    gitCommitMessage,
    setGitCommitMessage,
    refreshGitRepositoryStatus,
    stageGitFile,
    unstageGitFile,
    discardGitFile,
    commitGitChanges,
    pullGitChanges,
    pushGitChanges,
    isPackagesOpen,
    setPackagesOpen,
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
  };
}
