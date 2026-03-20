import type {
  CanvasWindow,
  ChatWindow,
  GitWindow,
  MentionSuggestion,
  SearchMatch,
  SlashSuggestion,
  TerminalWindow,
  ThreadSnapshot,
} from "@pidesk/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pidesk/shared";
import * as React from "react";
import { useStore } from "zustand";
import type { WorkspaceShellProps } from "../components/workspace/workspace-shell";
import { getLinkColorForId, getLinkColorHex } from "../lib/link-colors";
import { loadPromptAutocompleteSuggestions } from "../lib/prompt-autocomplete-loader";
import {
  buildFileMention,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  planPromptDispatch,
  replacePromptToken,
} from "../lib/prompt-routing";
import { getEffectiveLeftSidebarWidth } from "../stores/app-shell-store";
import { uiInteractionStore } from "../stores/ui-interaction-store";
import { getCenteredWindowPosition } from "../stores/window-store";
import {
  hoverSearchResultForWorktree,
  openFileWindowForWorktree,
  openProjectNoteWindowForWorktree,
  saveFileWindowForWorktree,
  saveNoteWindowForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
  updateSearchWindowQueryForWorktree,
} from "../stores/workspace-session-runtime";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
  useShellModel,
} from "./use-shell-model";
import { useWindowStore, workspaceSessionStore } from "./use-window-store";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];
const LAUNCHER_WINDOW_ID = "overlay-launcher";

function getThreadWindowTitle(
  thread: ThreadSnapshot | null | undefined,
): string {
  const title = thread?.title.trim();
  return title && title.length > 0 ? title : "Untitled thread";
}

export interface AppShellController {
  workspaceShellProps: WorkspaceShellProps;
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
  isCreateWorktreeOpen: boolean;
  setCreateWorktreeOpen: (isOpen: boolean) => void;
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
  const { agent, draft, shell } = state;
  const { state: windowState, store: windowStore } = useWindowStore();
  const activeRepository = React.useMemo(
    () => getActiveRepository(shell),
    [shell],
  );
  const activeWorktree = React.useMemo(() => getActiveWorktree(shell), [shell]);
  const activeThread = React.useMemo(() => getActiveThread(shell), [shell]);
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
  const [newWorktreeBranch, setNewWorktreeBranchState] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const leftSidebarWidth = React.useMemo(
    () => getEffectiveLeftSidebarWidth(appPreferences),
    [appPreferences],
  );
  const searchRequestVersionsRef = React.useRef(new Map<string, number>());

  const setNewWorktreeBranch = React.useCallback((value: string) => {
    setNewWorktreeBranchState(value);
  }, []);
  const setNoteContentState = React.useCallback(
    (windowId: string, value: string) => {
      workspaceSessionStore.getState().setNoteContent(windowId, value);
    },
    [],
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
  const setSettingsOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("settings", isOpen);
  }, []);
  const setCreateWorktreeOpen = React.useCallback((isOpen: boolean) => {
    uiInteractionStore.getState().setDialogOpen("createWorktree", isOpen);
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

  const threadLookup = React.useMemo(() => {
    const lookup = new Map<string, ThreadSnapshot>();
    for (const repository of repositories) {
      for (const worktree of repository.worktrees) {
        for (const thread of worktree.threads) {
          lookup.set(thread.id, thread);
        }
      }
    }
    return lookup;
  }, [repositories]);

  const handleLeftSidebarResize = React.useCallback(
    (width: number) => {
      void updateAppPreferences({ leftSidebarWidth: width });
    },
    [updateAppPreferences],
  );

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

  const openOrFocusChatWindow = React.useCallback(
    (threadId: string, options?: { canvasBounds?: DOMRect | null }) => {
      const thread = threadLookup.get(threadId);
      const title = getThreadWindowTitle(thread);
      const existingChatWindow = windowState.layout.windows.find(
        (window): window is ChatWindow =>
          window.kind === "chat" && window.threadId === threadId,
      );

      if (existingChatWindow) {
        windowStore.updateWindow(existingChatWindow.id, {
          title,
          state:
            existingChatWindow.state === "minimized"
              ? "normal"
              : existingChatWindow.state,
          linkColor: getLinkColorForId(threadId),
          linkTargetIds: [threadId],
        });
        windowStore.focusWindow(existingChatWindow.id);
        return existingChatWindow.id;
      }

      const centeredPosition = options?.canvasBounds
        ? getCenteredWindowPosition({
            viewportWidth: options.canvasBounds.width,
            viewportHeight: options.canvasBounds.height,
            windowWidth: 640,
            windowHeight: 420,
            zoom: windowState.layout.zoom,
            panX: windowState.layout.panX,
            panY: windowState.layout.panY,
          })
        : undefined;

      const chatWindow = windowStore.createWindow(
        { kind: "chat", threadId, title },
        activeWorktreePath ?? undefined,
        centeredPosition
          ? {
              ...centeredPosition,
              width: 640,
              height: 420,
            }
          : undefined,
      );
      windowStore.updateWindow(chatWindow.id, {
        title,
        linkColor: getLinkColorForId(threadId),
        linkTargetIds: [threadId],
      });
      return chatWindow.id;
    },
    [
      activeWorktreePath,
      threadLookup,
      windowState.layout.panX,
      windowState.layout.panY,
      windowState.layout.windows,
      windowState.layout.zoom,
      windowStore,
    ],
  );

  React.useEffect(() => {
    for (const window of windowState.layout.windows) {
      if (window.kind !== "chat") {
        continue;
      }
      const thread = threadLookup.get(window.threadId);
      if (!thread) {
        continue;
      }
      const nextTitle = getThreadWindowTitle(thread);
      const nextLinkColor = getLinkColorForId(window.threadId);
      const hasExactThreadLink =
        window.linkTargetIds?.length === 1 &&
        window.linkTargetIds[0] === window.threadId;

      if (
        window.title === nextTitle &&
        window.linkColor === nextLinkColor &&
        hasExactThreadLink
      ) {
        continue;
      }

      windowStore.updateWindow(window.id, {
        title: nextTitle,
        linkColor: nextLinkColor,
        linkTargetIds: [window.threadId],
      });
    }
  }, [threadLookup, windowState.layout.windows, windowStore]);

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
  const focusedWindow =
    windowState.layout.windows.find(
      (window) => window.id === windowState.layout.focusedWindowId,
    ) ?? null;
  const isPromptExecuting =
    agent.status === "starting" || agent.status === "streaming";
  const isPromptVisible =
    activeThreadId !== null &&
    (!focusedWindow || focusedWindow.kind === "chat");

  const handleFileClick = React.useCallback(
    async (filePath: string) => {
      await openFileWindowForWorktree({
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
      (w): w is TerminalWindow => w.kind === "terminal",
    );
    if (existingTerminal) {
      windowStore.focusWindow(existingTerminal.id);
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
    if (activeThreadId) {
      windowStore.updateWindow(terminalWindow.id, {
        linkedThreadId: activeThreadId,
        linkColor: getLinkColorForId(activeThreadId),
        linkTargetIds: [activeThreadId],
      });
    }
  }, [
    activeThreadId,
    activeWorktreePath,
    windowState.layout.windows,
    windowStore,
  ]);

  const handleOpenGit = React.useCallback(() => {
    if (!activeWorktreePath) {
      return;
    }

    const existingGitWindow = windowState.layout.windows.find(
      (w): w is GitWindow =>
        w.kind === "git" && w.repositoryPath === activeWorktreePath,
    );
    if (existingGitWindow) {
      windowStore.focusWindow(existingGitWindow.id);
      return;
    }

    const gitWindow = windowStore.createWindow(
      { kind: "git", repositoryPath: activeWorktreePath },
      activeWorktreePath,
    );
    windowStore.updateWindow(gitWindow.id, {
      title: `Git · ${activeRepository?.name ?? "Repository"}`,
    });
    if (activeThreadId) {
      windowStore.updateWindow(gitWindow.id, {
        linkColor: getLinkColorForId(activeThreadId),
        linkTargetIds: [activeThreadId],
      });
    }
  }, [
    activeRepository?.name,
    activeThreadId,
    activeWorktreePath,
    windowState.layout.windows,
    windowStore,
  ]);

  const handleOpenNote = React.useCallback(() => {
    void openProjectNoteWindowForWorktree({
      sessionStore: workspaceSessionStore,
      windowActions: {
        createWindow: windowStore.createWindow,
        focusWindow: windowStore.focusWindow,
        updateWindow: windowStore.updateWindow,
      },
      windows: windowState.layout.windows,
      worktreeId: activeWorktreeId,
      worktreePath: activeWorktreePath,
      readFile: (filePath) => window.pidesk.fs.readFile(filePath),
    }).then((noteWindowId) => {
      if (!activeThreadId) {
        return;
      }

      windowStore.updateWindow(noteWindowId, {
        linkColor: getLinkColorForId(activeThreadId),
        linkTargetIds: [activeThreadId],
      });
    });
  }, [
    activeThreadId,
    activeWorktreeId,
    activeWorktreePath,
    windowState.layout.windows,
    windowStore,
  ]);

  const handleOpenBlankStateChat = React.useCallback(
    async (canvasBounds: DOMRect | null) => {
      if (activeThreadId) {
        openOrFocusChatWindow(activeThreadId, { canvasBounds });
        return true;
      }

      const firstVisibleThreadId =
        activeWorktree?.threads.find((thread) => !thread.isArchived)?.id ??
        null;

      if (firstVisibleThreadId) {
        await window.pidesk.threads.select(firstVisibleThreadId);
        await reload();
        return true;
      }

      if (!activeWorktreeId) {
        return false;
      }

      await window.pidesk.threads.create(activeWorktreeId, "Canvas Chat");
      await reload();
      return true;
    },
    [
      activeThreadId,
      activeWorktree?.threads,
      activeWorktreeId,
      openOrFocusChatWindow,
      reload,
    ],
  );

  const handleOpenLauncher = React.useCallback(() => {
    openLauncherOverlay();
  }, [openLauncherOverlay]);

  const handleOpenGraph = React.useCallback(() => {
    const existingGraphWindow = windowState.layout.windows.find(
      (w) => w.kind === "graph",
    );
    if (existingGraphWindow) {
      windowStore.focusWindow(existingGraphWindow.id);
      return;
    }

    windowStore.createWindow(
      { kind: "graph" },
      activeWorktreePath ?? undefined,
    );
  }, [activeWorktreePath, windowState.layout.windows, windowStore]);

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

  const handleNoteContentChange = React.useCallback(
    (windowId: string, newContent: string) => {
      setNoteContentState(windowId, newContent);
      windowStore.setDirty(windowId, true);
    },
    [setNoteContentState, windowStore],
  );

  const handleNoteSave = React.useCallback(
    async (windowId: string, storagePath?: string) => {
      try {
        const didSave = await saveNoteWindowForWorktree({
          sessionStore: workspaceSessionStore,
          worktreeId: activeWorktreeId,
          windowId,
          storagePath,
          writeFile: (nextFilePath, content) =>
            window.pidesk.fs.writeFile(nextFilePath, content),
        });
        if (didSave) {
          windowStore.setDirty(windowId, false);
        }
      } catch (error) {
        console.error("Failed to save note:", error);
      }
    },
    [activeWorktreeId, windowStore],
  );

  const handleSearchQueryChange = React.useCallback(
    async (windowId: string, query: string) => {
      await updateSearchWindowQueryForWorktree({
        sessionStore: workspaceSessionStore,
        requestVersions: searchRequestVersionsRef.current,
        worktreeId: activeWorktreeId,
        worktreePath: activeWorktreePath,
        windowId,
        query,
        searchFiles: (args) => window.pidesk.search.searchFiles(args),
      });
    },
    [activeWorktreeId, activeWorktreePath],
  );

  const handleSearchSelect = React.useCallback(
    (match: SearchMatch) => {
      if (match.type === "file") {
        void handleFileClick(match.path);
        return;
      }
      openFileTreeOverlay();
    },
    [handleFileClick, openFileTreeOverlay],
  );

  const handleSearchHover = React.useCallback(
    (windowId: string, index: number) => {
      hoverSearchResultForWorktree({
        sessionStore: workspaceSessionStore,
        worktreeId: activeWorktreeId,
        windowId,
        index,
      });

      if (windowId === LAUNCHER_WINDOW_ID) {
        uiInteractionStore.getState().setLauncherSelectedIndex(index);
      }
    },
    [activeWorktreeId],
  );

  const handleSearchKeyDown = React.useCallback(
    (windowId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (windowId !== LAUNCHER_WINDOW_ID) {
        return;
      }

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
          handleSearchSelect(selectedMatch);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeLauncherOverlay();
      }
    },
    [closeLauncherOverlay, handleSearchSelect],
  );

  const handleLauncherQueryChange = React.useCallback(
    async (query: string) => {
      const interactions = uiInteractionStore.getState();
      interactions.setLauncherQuery(query);

      const requestVersion =
        (searchRequestVersionsRef.current.get(LAUNCHER_WINDOW_ID) ?? 0) + 1;
      searchRequestVersionsRef.current.set(LAUNCHER_WINDOW_ID, requestVersion);

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

        if (
          searchRequestVersionsRef.current.get(LAUNCHER_WINDOW_ID) !==
          requestVersion
        ) {
          return;
        }

        interactions.setLauncherResults(response.results);
        interactions.setLauncherLoading(false);
      } catch {
        if (
          searchRequestVersionsRef.current.get(LAUNCHER_WINDOW_ID) !==
          requestVersion
        ) {
          return;
        }

        interactions.setLauncherResults([]);
        interactions.setLauncherSelectedIndex(-1);
        interactions.setLauncherLoading(false);
      }
    },
    [activeWorktreePath],
  );

  const handleLauncherHover = React.useCallback((index: number) => {
    uiInteractionStore.getState().setLauncherSelectedIndex(index);
  }, []);

  const handleLauncherKeyDown = React.useMemo(
    () => handleSearchKeyDown(LAUNCHER_WINDOW_ID),
    [handleSearchKeyDown],
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
      await window.pidesk.threads.create(worktreeId);
      await reload();
    },
    [reload],
  );

  const handleCloseThread = React.useCallback(
    async (threadId: string) => {
      // Close any chat windows for this thread
      const chatWindow = windowState.layout.windows.find(
        (w): w is ChatWindow => w.kind === "chat" && w.threadId === threadId,
      );
      if (chatWindow) {
        windowStore.closeWindow(chatWindow.id);
      }
      // Archive the thread
      await window.pidesk.threads.archive(threadId);
      await reload();
    },
    [windowState.layout.windows, windowStore, reload],
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
      await window.pidesk.threads.select(threadId);
      await reload();
      openOrFocusChatWindow(threadId);
    },
    [openOrFocusChatWindow, reload],
  );

  const handleWindowFocus = React.useCallback(
    async (focusedWindow: CanvasWindow) => {
      if (
        focusedWindow.kind !== "chat" ||
        focusedWindow.threadId === activeThreadId
      ) {
        return;
      }
      await window.pidesk.threads.select(focusedWindow.threadId);
      await reload();
    },
    [activeThreadId, reload],
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
    const dispatchPlan = planPromptDispatch({
      draft,
      canSend,
      activeThreadId,
    });

    if (dispatchPlan.action === "noop") {
      return;
    }

    if (dispatchPlan.action === "route") {
      try {
        await window.pidesk.threads.routeToTerminal({
          terminalId: dispatchPlan.terminalId,
          prompt: dispatchPlan.prompt,
          startPiIfNotLinked: true,
        });
        setDraft(dispatchPlan.nextDraft);
      } catch (error) {
        console.error("Failed to route prompt to terminal:", error);
      }
      return;
    }

    if (dispatchPlan.nextDraft !== draft) {
      setDraft(dispatchPlan.nextDraft);
    }

    openOrFocusChatWindow(dispatchPlan.threadId);
    void sendPrompt();
  }, [
    activeThreadId,
    canSend,
    draft,
    openOrFocusChatWindow,
    sendPrompt,
    setDraft,
  ]);

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

  const graphNodes = React.useMemo(() => {
    const nodes = windowState.layout.windows.map((window) => ({
      id: window.id,
      label: window.title,
      color: window.linkColor ? getLinkColorHex(window.linkColor) : "#737373",
      radius: 18,
    }));

    if (activeThreadId) {
      nodes.push({
        id: activeThreadId,
        label: activeThread?.title ?? "Active Thread",
        color: getLinkColorHex(getLinkColorForId(activeThreadId)),
        radius: 22,
      });
    }

    return nodes;
  }, [activeThread?.title, activeThreadId, windowState.layout.windows]);

  const graphLinks = React.useMemo(() => {
    const links: Array<{
      source: string;
      target: string;
      color?: string;
      label?: string;
    }> = [];

    for (const window of windowState.layout.windows) {
      for (const targetId of window.linkTargetIds ?? []) {
        const color = window.linkColor
          ? getLinkColorHex(window.linkColor)
          : "#525252";
        links.push({
          source: window.id,
          target: targetId,
          color,
          label: "linked",
        });
      }

      if (window.kind === "terminal" && window.linkedThreadId) {
        links.push({
          source: window.id,
          target: window.linkedThreadId,
          color: window.linkColor
            ? getLinkColorHex(window.linkColor)
            : getLinkColorHex(getLinkColorForId(window.linkedThreadId)),
          label: "thread",
        });
      }
    }

    return links;
  }, [windowState.layout.windows]);

  const workspaceShellProps: WorkspaceShellProps = {
    repositories,
    activeRepository,
    activeRepositoryId,
    activeWorktreeId,
    activeThreadId,
    activeThreadTitle: activeThread ? getThreadWindowTitle(activeThread) : null,
    draft,
    canSend,
    leftSidebarWidth,
    snapGridSize: windowState.layout.snapGridSize,
    windowCount: windowState.layout.windows.length,
    threadLookup,
    graphNodes,
    graphLinks,
    autocompleteSuggestions,
    autocompleteSelectedIndex,
    displayAgentStatus,
    runtimeModeLabel,
    providerSnapshots,
    currentModelValue,
    isSwitchingModel,
    isLauncherOpen,
    isFileTreeOpen,
    launcherQuery,
    launcherResults,
    launcherSelectedIndex,
    launcherIsLoading,
    isPromptVisible,
    isPromptExecuting,
    onModelMenuOpenChange: handleModelMenuOpenChange,
    onAddRepository: handleAddRepository,
    onSelectRepository: handleSelectRepository,
    onUpdateRepositoryPreferences: updateRepositoryPreferences,
    onOpenSettings: handleOpenSettings,
    onSelectWorktree: handleSelectWorktree,
    onSelectThread: handleSelectThread,
    onCreateThread: handleCreateThread,
    onCloseThread: handleCloseThread,
    onRenameThread: handleRenameThread,
    onCreateWorktree: handleCreateWorktree,
    onLeftSidebarResize: handleLeftSidebarResize,
    onOpenLauncher: handleOpenLauncher,
    onCloseLauncher: closeLauncherOverlay,
    onOpenFileTree: openFileTreeOverlay,
    onCloseFileTree: closeFileTreeOverlay,
    onOpenBlankStateChat: handleOpenBlankStateChat,
    onOpenNote: handleOpenNote,
    onOpenGit: handleOpenGit,
    onOpenTerminal: handleOpenTerminal,
    onOpenGraph: handleOpenGraph,
    onFileClick: handleFileClick,
    onFileContentChange: handleFileContentChange,
    onFileSave: handleFileSave,
    onNoteContentChange: handleNoteContentChange,
    onNoteSave: handleNoteSave,
    onSearchQueryChange: handleSearchQueryChange,
    onSearchSelect: handleSearchSelect,
    onSearchHover: handleSearchHover,
    onSearchKeyDown: handleSearchKeyDown,
    onLauncherQueryChange: handleLauncherQueryChange,
    onLauncherSelect: handleSearchSelect,
    onLauncherHover: handleLauncherHover,
    onLauncherKeyDown: handleLauncherKeyDown,
    onWindowFocus: handleWindowFocus,
    onDraftChange: setDraft,
    onSend: handleSend,
    onCancelPrompt: handleCancelPrompt,
    onAutocompleteSelect: handleAutocompleteSelect,
    onAutocompleteHover: setAutocompleteSelectedIndex,
    onPromptKeyDown: handlePromptKeyDown,
    onModelSelection: handleModelSelection,
  };

  return {
    workspaceShellProps,
    isSettingsOpen,
    setSettingsOpen,
    isCreateWorktreeOpen,
    setCreateWorktreeOpen,
    newWorktreeBranch,
    setNewWorktreeBranch,
    worktreeCreateError,
    submitCreateWorktree,
  };
}
