import type {
  CanvasWindow,
  ChatWindow,
  GitWindow,
  MentionSuggestion,
  SearchMatch,
  SearchWindow,
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
import {
  hoverSearchResultForWorktree,
  initializeSearchWindowForWorktree,
  openFileWindowForWorktree,
  saveFileWindowForWorktree,
  saveNoteWindowForWorktree,
  selectSearchResultIndexForWorktree,
  syncActiveThreadConversation,
  updateFileDraftForWorktree,
  updateSearchWindowQueryForWorktree,
} from "../stores/workspace-session-runtime";
import { selectSearchUiStateByWorktree } from "../stores/workspace-session-selectors";
import {
  parseModelSelectionValue,
  resolveCurrentModelValue,
  useShellModel,
} from "./use-shell-model";
import { useWindowStore, workspaceSessionStore } from "./use-window-store";

const EMPTY_AUTOCOMPLETE_SUGGESTIONS: (SlashSuggestion | MentionSuggestion)[] =
  [];

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
  const [sidebarView, setSidebarViewState] = React.useState<
    "files" | "git" | "notes" | null
  >(null);
  const leftSidebarWidth = React.useMemo(
    () => getEffectiveLeftSidebarWidth(appPreferences),
    [appPreferences],
  );
  const searchRequestVersionsRef = React.useRef(new Map<string, number>());

  const setSidebarView = React.useCallback(
    (view: "files" | "git" | "notes" | null) => {
      setSidebarViewState(view);
    },
    [],
  );
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
    (threadId: string) => {
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

      const chatWindow = windowStore.createWindow(
        { kind: "chat", threadId, title },
        activeWorktreePath ?? undefined,
      );
      windowStore.updateWindow(chatWindow.id, {
        title,
        linkColor: getLinkColorForId(threadId),
        linkTargetIds: [threadId],
      });
      return chatWindow.id;
    },
    [activeWorktreePath, threadLookup, windowState.layout.windows, windowStore],
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
    },
    [
      activeWorktreeId,
      activeWorktreePath,
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
    const noteWindow = windowStore.createWindow(
      { kind: "note" },
      activeWorktreePath ?? undefined,
    );
    const noteCount =
      windowState.layout.windows.filter((w) => w.kind === "note").length + 1;
    const storagePath = activeWorktreePath
      ? `${activeWorktreePath.replace(/[\\/]+$/, "")}/.pidesk/notes/${noteWindow.id}.md`
      : undefined;

    windowStore.updateWindow(noteWindow.id, {
      title: `Note ${noteCount}`,
      storagePath,
    });
    setNoteContentState(noteWindow.id, "");
    if (activeThreadId) {
      windowStore.updateWindow(noteWindow.id, {
        linkColor: getLinkColorForId(activeThreadId),
        linkTargetIds: [activeThreadId],
      });
    }
  }, [
    activeThreadId,
    activeWorktreePath,
    setNoteContentState,
    windowState.layout.windows,
    windowStore,
  ]);

  const handleOpenLauncher = React.useCallback(() => {
    const existingSearchWindow = windowState.layout.windows.find(
      (w): w is SearchWindow => w.kind === "search",
    );
    if (existingSearchWindow) {
      windowStore.focusWindow(existingSearchWindow.id);
      return;
    }

    const searchWindow = windowStore.createWindow(
      { kind: "search" },
      activeWorktreePath ?? undefined,
    );
    windowStore.updateWindow(searchWindow.id, { title: "Pi Launcher" });
    initializeSearchWindowForWorktree({
      sessionStore: workspaceSessionStore,
      worktreeId: activeWorktreeId,
      windowId: searchWindow.id,
    });
  }, [
    activeWorktreeId,
    activeWorktreePath,
    windowState.layout.windows,
    windowStore,
  ]);

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
      setSidebarView("files");
    },
    [handleFileClick, setSidebarView],
  );

  const handleSearchHover = React.useCallback(
    (windowId: string, index: number) => {
      hoverSearchResultForWorktree({
        sessionStore: workspaceSessionStore,
        worktreeId: activeWorktreeId,
        windowId,
        index,
      });
    },
    [activeWorktreeId],
  );

  const handleSearchKeyDown = React.useCallback(
    (windowId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      const searchWindow = windowState.layout.windows.find(
        (w): w is SearchWindow => w.id === windowId && w.kind === "search",
      );
      if (!searchWindow) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectSearchResultIndexForWorktree({
          sessionStore: workspaceSessionStore,
          worktreeId: activeWorktreeId,
          windowId,
          results: searchWindow.results,
          direction: "next",
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectSearchResultIndexForWorktree({
          sessionStore: workspaceSessionStore,
          worktreeId: activeWorktreeId,
          windowId,
          results: searchWindow.results,
          direction: "previous",
        });
        return;
      }

      if (event.key === "Enter") {
        const selectedIndex =
          selectSearchUiStateByWorktree(
            workspaceSessionStore.getState(),
            activeWorktreeId,
            windowId,
          )?.selectedIndex ?? -1;
        const selectedMatch =
          selectedIndex >= 0 ? searchWindow.results[selectedIndex] : undefined;
        if (selectedMatch) {
          event.preventDefault();
          handleSearchSelect(selectedMatch);
        }
      }
    },
    [activeWorktreeId, handleSearchSelect, windowState.layout.windows],
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

  const hasOpenNotes = React.useMemo(
    () => windowState.layout.windows.some((window) => window.kind === "note"),
    [windowState.layout.windows],
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

  const runtimeMode = shell.runtime?.agentMode ?? "unknown";
  const runtimeModeLabel = `${runtimeMode} mode`;
  const displayAgentStatus =
    agent.status === "starting" ? "ready" : agent.status;
  const currentModelValue = React.useMemo(
    () => resolveCurrentModelValue(providerSnapshots, settingsSnapshot),
    [providerSnapshots, settingsSnapshot],
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
    activeWorktreePath,
    activeThreadId,
    activeThreadTitle: activeThread ? getThreadWindowTitle(activeThread) : null,
    draft,
    canSend,
    sidebarView,
    setSidebarView,
    hasOpenNotes,
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
    onAddRepository: handleAddRepository,
    onSelectRepository: handleSelectRepository,
    onUpdateRepositoryPreferences: updateRepositoryPreferences,
    onOpenSettings: handleOpenSettings,
    onSelectWorktree: handleSelectWorktree,
    onSelectThread: handleSelectThread,
    onCreateThread: handleCreateThread,
    onCreateWorktree: handleCreateWorktree,
    onLeftSidebarResize: handleLeftSidebarResize,
    onOpenLauncher: handleOpenLauncher,
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
    onWindowFocus: handleWindowFocus,
    onDraftChange: setDraft,
    onSend: handleSend,
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
