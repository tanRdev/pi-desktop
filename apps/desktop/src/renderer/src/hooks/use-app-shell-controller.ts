import type {
  MentionSuggestion,
  SearchMatch,
  SlashSuggestion,
  ThreadSnapshot,
} from "@pidesk/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pidesk/shared";
import * as React from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import type { WorkspaceShellProps } from "../components/workspace/workspace-shell";
import { loadPromptAutocompleteSuggestions } from "../lib/prompt-autocomplete-loader";
import {
  buildFileMention,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  replacePromptToken,
} from "../lib/prompt-routing";
import { uiInteractionStore } from "../stores/ui-interaction-store";
import {
  openFileWindowForWorktree,
  saveFileWindowForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
} from "../stores/workspace-session-runtime";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
  useShellModel,
} from "./use-shell-model";
import { useWindowStore, workspaceSessionStore } from "./use-window-store";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];
const PENDING_SURFACE_PREFIX = "__pending_surface__";

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
  return title && title.length > 0 ? title : "Untitled thread";
}

function getInitialContextSurface(
  windows: WorkspaceShellProps["contextWindows"],
  current: WorkspaceShellProps["selectedContextSurface"] | null,
): WorkspaceShellProps["selectedContextSurface"] {
  if (current === null) {
    return current;
  }

  if (current === "activity") {
    return current;
  }

  if (current && windows.some((window) => window.id === current)) {
    return current;
  }

  return current;
}

export interface AppShellController {
  workspaceShellProps: WorkspaceShellProps;
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
  isCreateWorktreeOpen: boolean;
  setCreateWorktreeOpen: (isOpen: boolean) => void;
  isCreateThreadOpen: boolean;
  setCreateThreadOpen: (isOpen: boolean) => void;
  pendingThreadRepositoryName: string | null;
  newThreadName: string;
  setNewThreadName: (value: string) => void;
  threadCreateError: string | null;
  submitCreateThread: () => Promise<void>;
  confirmRemoveRepositoryName: string | null;
  isRemoveRepositoryOpen: boolean;
  setRemoveRepositoryOpen: (isOpen: boolean) => void;
  removeRepositoryError: string | null;
  submitRemoveRepository: () => Promise<void>;
  toastMessage: string | null;
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
    appPreferences,
    isSwitchingModel,
    switchModel,
    updateAppPreferences,
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
  const launcherQuery = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.launcher.query,
  );
  const isLauncherOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.launcher.isOpen,
  );
  const launcherResults = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.launcher.results,
  );
  const launcherSelectedIndex = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.launcher.selectedIndex,
  );
  const launcherIsLoading = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.launcher.isLoading,
  );
  const isFileTreeOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.overlays.fileTree.isOpen,
  );
  const isSettingsOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.settings,
  );
  const isCreateWorktreeOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.createWorktree,
  );
  const isCreateThreadOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.createThread,
  );
  const isRemoveRepositoryOpen = useStore(
    uiInteractionStore,
    (storeState) => storeState.dialogs.confirmRemoveRepository,
  );

  const [newWorktreeBranch, setNewWorktreeBranchState] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const [newThreadName, setNewThreadNameState] = React.useState("");
  const [threadCreateError, setThreadCreateError] = React.useState<
    string | null
  >(null);
  const [pendingThreadWorktreeId, setPendingThreadWorktreeId] = React.useState<
    string | null
  >(null);
  const [pendingThreadRepositoryName, setPendingThreadRepositoryName] =
    React.useState<string | null>(null);
  const [confirmRemoveRepositoryId, setConfirmRemoveRepositoryId] =
    React.useState<string | null>(null);
  const [confirmRemoveRepositoryName, setConfirmRemoveRepositoryName] =
    React.useState<string | null>(null);
  const [removeRepositoryError, setRemoveRepositoryError] = React.useState<
    string | null
  >(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [selectedContextSurface, setSelectedContextSurface] =
    React.useState<WorkspaceShellProps["selectedContextSurface"]>(null);
  const [leftRailWidth, setLeftRailWidth] = React.useState(260);
  const [promptMode, setPromptMode] = React.useState<PromptMode>(() =>
    detectPromptMode(draft),
  );
  const launcherRequestIdRef = React.useRef(0);

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
  const setSettingsOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("settings", isOpen);
  }, []);
  const setCreateWorktreeOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("createWorktree", isOpen);
  }, []);
  const setCreateThreadDialogOpenState = React.useCallback(
    (isOpen: boolean) => {
      uiInteractionStore.getState().setDialogOpen("createThread", isOpen);
    },
    [],
  );
  const setCreateThreadOpen = React.useCallback(
    (isOpen: boolean) => {
      setCreateThreadDialogOpenState(isOpen);

      if (isOpen) {
        return;
      }

      setPendingThreadWorktreeId(null);
      setPendingThreadRepositoryName(null);
      setNewThreadNameState("");
      setThreadCreateError(null);
    },
    [setCreateThreadDialogOpenState],
  );
  const setRemoveRepositoryOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore
      .getState()
      .setDialogOpen("confirmRemoveRepository", isOpen);
  }, []);
  const openLauncherOverlay = React.useCallback(() => {
    uiInteractionStore.getState().openLauncherOverlay();
  }, []);
  const closeLauncherOverlay = React.useCallback(() => {
    uiInteractionStore.getState().closeLauncherOverlay();
  }, []);
  const openFileTreeOverlay = React.useCallback(() => {
    uiInteractionStore.getState().openFileTreeOverlay();
  }, []);
  const closeFileTreeOverlay = React.useCallback(() => {
    uiInteractionStore.getState().closeFileTreeOverlay();
  }, []);

  const handleOpenSettings = React.useCallback(() => {
    setSettingsOpen(true);
  }, [setSettingsOpen]);

  React.useEffect(() => {
    setPromptMode(detectPromptMode(draft));
  }, [draft]);

  React.useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

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
    agent.status === "starting" || agent.status === "streaming";
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
      closeLauncherOverlay();
      closeFileTreeOverlay();
    },
    [
      activeWorktreeId,
      activeWorktreePath,
      closeFileTreeOverlay,
      closeLauncherOverlay,
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
      > => window.kind === "terminal",
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

  const handleOpenActivity = React.useCallback(() => {
    setSelectedContextSurface((current) =>
      current === "activity" ? null : "activity",
    );
  }, []);

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
      try {
        const didSave = await saveFileWindowForWorktree({
          sessionStore: workspaceSessionStore,
          worktreeId: activeWorktreeId,
          windowId,
          filePath,
          writeFile: (nextFilePath, content) =>
            window.pidesk.fs.writeFile(nextFilePath, content),
        });
        if (didSave) {
          windowStore.setDirty(windowId, false);
        }
      } catch (error) {
        console.error("Failed to save file:", error);
      }
    },
    [activeWorktreeId, windowStore],
  );

  const handleLauncherQueryChange = React.useCallback(
    async (query: string) => {
      const interactions = uiInteractionStore.getState();
      interactions.setLauncherQuery(query);
      launcherRequestIdRef.current += 1;
      const requestId = launcherRequestIdRef.current;

      if (!query.trim() || !activeWorktreePath) {
        interactions.setLauncherResults([]);
        interactions.setLauncherSelectedIndex(-1);
        interactions.setLauncherLoading(false);
        return;
      }

      interactions.setLauncherLoading(true);

      try {
        const response = await window.pidesk.search.searchFiles({
          query,
          rootPath: activeWorktreePath,
          maxResults: 20,
        });

        if (launcherRequestIdRef.current !== requestId) {
          return;
        }

        interactions.setLauncherResults(response.results);
        interactions.setLauncherLoading(false);
      } catch {
        if (launcherRequestIdRef.current !== requestId) {
          return;
        }

        interactions.setLauncherResults([]);
        interactions.setLauncherSelectedIndex(-1);
        interactions.setLauncherLoading(false);
      }
    },
    [activeWorktreePath],
  );

  const handleLauncherSelect = React.useCallback(
    (match: SearchMatch) => {
      if (match.type === "file") {
        void handleFileClick(match.path);
        return;
      }
      openFileTreeOverlay();
    },
    [handleFileClick, openFileTreeOverlay],
  );

  const handleLauncherHover = React.useCallback((index: number) => {
    uiInteractionStore.getState().setLauncherSelectedIndex(index);
  }, []);

  const handleLauncherKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const launcherState = uiInteractionStore.getState().overlays.launcher;
      const results = launcherState.results;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (results.length === 0) {
          return;
        }
        const nextIndex =
          launcherState.selectedIndex < results.length - 1
            ? launcherState.selectedIndex + 1
            : 0;
        uiInteractionStore.getState().setLauncherSelectedIndex(nextIndex);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (results.length === 0) {
          return;
        }
        const previousIndex =
          launcherState.selectedIndex > 0
            ? launcherState.selectedIndex - 1
            : results.length - 1;
        uiInteractionStore.getState().setLauncherSelectedIndex(previousIndex);
        return;
      }

      if (event.key === "Enter") {
        const selectedMatch =
          launcherState.selectedIndex >= 0
            ? results[launcherState.selectedIndex]
            : undefined;
        if (selectedMatch) {
          event.preventDefault();
          handleLauncherSelect(selectedMatch);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeLauncherOverlay();
      }
    },
    [closeLauncherOverlay, handleLauncherSelect],
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
      await window.pidesk.repositories.add(repositoryPath);
    }
    await reload();
  }, [reload]);

  const handleSelectRepository = React.useCallback(
    async (repositoryId: string) => {
      await window.pidesk.repositories.select(repositoryId);
      await reload();
    },
    [reload],
  );

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
      setToastMessage("Project path copied");
    },
    [repositories],
  );

  const handleOpenInFinder = React.useCallback(async (repositoryId: string) => {
    await window.pidesk.repositories.openInFinder(repositoryId);
    setToastMessage("Opened project in Finder");
  }, []);

  const handleCreateWorktree = React.useCallback(() => {
    setWorktreeCreateError(null);
    setNewWorktreeBranchState("");
    setCreateWorktreeOpen(true);
  }, [setCreateWorktreeOpen]);

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
      toast.success(
        `Worktree "${newWorktreeBranch.trim()}" created successfully`,
      );
      await reload();
    } catch (error) {
      setWorktreeCreateError(
        error instanceof Error ? error.message : "Failed to create worktree",
      );
    }
  }, [activeRepositoryId, newWorktreeBranch, reload, setCreateWorktreeOpen]);

  const handleSelectWorktree = React.useCallback(
    async (worktreeId: string) => {
      await window.pidesk.worktrees.select(worktreeId);
      await reload();
    },
    [reload],
  );

  const handleCreateThread = React.useCallback(
    async (worktreeId: string) => {
      const repositoryName =
        repositories.find((repository) =>
          repository.worktrees.some((worktree) => worktree.id === worktreeId),
        )?.customName ??
        repositories.find((repository) =>
          repository.worktrees.some((worktree) => worktree.id === worktreeId),
        )?.name ??
        null;
      setPendingThreadWorktreeId(worktreeId);
      setPendingThreadRepositoryName(repositoryName);
      setNewThreadNameState("");
      setThreadCreateError(null);
      setCreateThreadDialogOpenState(true);
    },
    [repositories, setCreateThreadDialogOpenState],
  );

  const submitCreateThread = React.useCallback(async () => {
    if (!pendingThreadWorktreeId) {
      return;
    }

    const trimmed = newThreadName.trim();
    const fallbackNames = [
      "Thread Atlas",
      "Thread Ember",
      "Thread Nova",
      "Thread Quartz",
      "Thread Harbor",
    ];
    const nextName =
      trimmed.length > 0
        ? trimmed
        : (fallbackNames[Math.floor(Math.random() * fallbackNames.length)] ??
          "New thread");

    try {
      await window.pidesk.threads.create(pendingThreadWorktreeId, nextName);
      setCreateThreadDialogOpenState(false);
      setPendingThreadWorktreeId(null);
      setPendingThreadRepositoryName(null);
      setNewThreadNameState("");
      setThreadCreateError(null);
      toast.success(`Thread "${nextName}" created successfully`);
      await reload();
    } catch (error) {
      setThreadCreateError(
        error instanceof Error ? error.message : "Failed to create thread",
      );
    }
  }, [
    newThreadName,
    pendingThreadWorktreeId,
    reload,
    setCreateThreadDialogOpenState,
  ]);

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
      setToastMessage("Project removed from rail");
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
      await reload();
    },
    [activeThreadId, reload],
  );

  const handleRenameThread = React.useCallback(
    async (threadId: string, title: string) => {
      await window.pidesk.threads.rename(threadId, title);
      await reload();
    },
    [reload],
  );

  const handleSelectThread = React.useCallback(
    async (threadId: string) => {
      setSelectedContextSurface(null);
      await window.pidesk.threads.select(threadId);
      await reload();
    },
    [reload],
  );

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

      try {
        await switchModel(selection);
      } catch (error) {
        console.error("Failed to switch model:", error);
      }
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

  const handleCloseContextSurface = React.useCallback(
    (surfaceKey: string) => {
      windowStore.closeWindow(surfaceKey);
      setSelectedContextSurface(null);
    },
    [windowStore],
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
    isLauncherOpen,
    isFileTreeOpen,
    isPromptVisible,
    isPromptExecuting,
    launcherQuery,
    launcherResults,
    launcherSelectedIndex,
    launcherIsLoading,
    threadMessages: agent.messages,
    threadLastError: agent.lastError,
    liveFeed: live,
    contextWindows,
    selectedContextSurface,
    leftRailWidth,
    onSelectContextSurface: handleSelectContextSurface,
    onLeftRailResize: handleLeftRailResize,
    onModelMenuOpenChange: handleModelMenuOpenChange,
    onAddRepository: handleAddRepository,
    onSelectRepository: handleSelectRepository,
    onRenameRepository: handleRenameRepository,
    onRemoveRepository: handleRemoveRepository,
    onCopyRepositoryPath: handleCopyRepositoryPath,
    onOpenInFinder: handleOpenInFinder,
    onOpenSettings: handleOpenSettings,
    onSelectWorktree: handleSelectWorktree,
    onSelectThread: handleSelectThread,
    onCreateThread: handleCreateThread,
    onCloseThread: handleCloseThread,
    onRenameThread: handleRenameThread,
    onOpenLauncher: openLauncherOverlay,
    onCloseLauncher: closeLauncherOverlay,
    onOpenFileTree: openFileTreeOverlay,
    onCloseFileTree: closeFileTreeOverlay,
    onOpenGit: handleOpenGit,
    onOpenTerminal: handleOpenTerminal,
    onOpenActivity: handleOpenActivity,
    onFileClick: handleFileClick,
    onFileContentChange: handleFileContentChange,
    onFileSave: handleFileSave,
    onLauncherQueryChange: handleLauncherQueryChange,
    onLauncherSelect: handleLauncherSelect,
    onLauncherHover: handleLauncherHover,
    onLauncherKeyDown: handleLauncherKeyDown,
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
    isSettingsOpen,
    setSettingsOpen,
    isCreateWorktreeOpen,
    setCreateWorktreeOpen,
    isCreateThreadOpen,
    setCreateThreadOpen,
    pendingThreadRepositoryName,
    newThreadName,
    setNewThreadName: setNewThreadNameState,
    threadCreateError,
    submitCreateThread,
    confirmRemoveRepositoryName,
    isRemoveRepositoryOpen,
    setRemoveRepositoryOpen,
    removeRepositoryError,
    submitRemoveRepository,
    toastMessage,
    newWorktreeBranch,
    setNewWorktreeBranch: setNewWorktreeBranchState,
    worktreeCreateError,
    submitCreateWorktree,
  };
}
