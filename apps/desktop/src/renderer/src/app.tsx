import type {
  AgentMessageSnapshot,
  ChatWindow,
  FileWindow,
  GitWindow,
  MentionSuggestion,
  ProviderSnapshot,
  SearchMatch,
  SearchWindow,
  SettingsSnapshot,
  SlashSuggestion,
  TerminalWindow,
  ThreadSnapshot,
} from "@pidesk/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pidesk/shared";
import { TooltipProvider } from "@pidesk/ui";
import * as React from "react";
import { CanvasContainer, WindowContentRouter } from "./components/canvas";
import { SettingsModal, SettingsProvider } from "./components/settings";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { FileTree } from "./components/ui/file-tree";
import { ScrollArea } from "./components/ui/scroll-area";
import { LeftRail } from "./components/workspace/left-rail";
import { LeftSidebar } from "./components/workspace/left-sidebar";
import { PromptDock } from "./components/workspace/prompt-dock";
import { TitleBar } from "./components/workspace/title-bar";
import {
  parseModelSelectionValue,
  reduceModelSelectionState,
  resolveCurrentModelValue,
  useShellModel,
} from "./hooks/use-shell-model";
import { useWindowStore } from "./hooks/use-window-store";
import { getLinkColorForId, getLinkColorHex } from "./lib/link-colors";
import {
  buildFileMention,
  buildMentionSuggestions,
  buildTerminalMention,
  getPromptAutocompleteMatch,
  planPromptDispatch,
  replacePromptToken,
} from "./lib/prompt-routing";
import {
  loadLeftSidebarWidth,
  saveLeftSidebarWidth,
} from "./lib/sidebar-preferences";

type ThreadConversationState = {
  messages: AgentMessageSnapshot[];
  status: string;
  lastError: string | null;
};

function getThreadWindowTitle(
  thread: ThreadSnapshot | null | undefined,
): string {
  const title = thread?.title.trim();
  return title && title.length > 0 ? title : "Untitled thread";
}

export default function App() {
  const { reload, sendPrompt, setDraft, state } = useShellModel();
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

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isCreateWorktreeOpen, setIsCreateWorktreeOpen] = React.useState(false);
  const [newWorktreeBranch, setNewWorktreeBranch] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const [sidebarView, setSidebarView] = React.useState<
    "files" | "git" | "notes" | null
  >(null);
  const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(() =>
    loadLeftSidebarWidth(),
  );

  const [fileContents, setFileContents] = React.useState<
    Map<
      string,
      {
        content: import("@pidesk/shared").FileContent | null;
        isLoading: boolean;
        error: string | null;
      }
    >
  >(new Map());
  const [noteContents, setNoteContents] = React.useState<
    Map<string, { content: string; error: string | null }>
  >(new Map());
  const [searchUiState, setSearchUiState] = React.useState<
    Map<string, { isLoading: boolean; selectedIndex: number }>
  >(new Map());
  const searchRequestVersionsRef = React.useRef(new Map<string, number>());
  const [autocompleteSuggestions, setAutocompleteSuggestions] = React.useState<
    (SlashSuggestion | MentionSuggestion)[]
  >([]);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] =
    React.useState(0);
  const [providerSnapshots, setProviderSnapshots] = React.useState<
    ProviderSnapshot[]
  >([]);
  const [settingsSnapshot, setSettingsSnapshot] =
    React.useState<SettingsSnapshot>({});
  const [modelSelectionState, dispatchModelSelectionState] = React.useReducer(
    reduceModelSelectionState,
    { isSwitchingModel: false },
  );
  const isSwitchingModel = modelSelectionState.isSwitchingModel;
  const [threadConversations, setThreadConversations] = React.useState<
    Map<string, ThreadConversationState>
  >(new Map());

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

  const handleLeftSidebarResize = React.useCallback((width: number) => {
    setLeftSidebarWidth(width);
    saveLeftSidebarWidth(width);
  }, []);

  React.useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    setThreadConversations((prev) => {
      const next = new Map(prev);
      next.set(activeThreadId, {
        messages: agent.messages,
        status: agent.status,
        lastError: agent.lastError,
      });
      return next;
    });
  }, [activeThreadId, agent.lastError, agent.messages, agent.status]);

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

  // Open a file in a new window or focus existing window
  const handleFileClick = React.useCallback(
    async (filePath: string) => {
      // Check if file is already open
      const existingWindow = windowState.layout.windows.find(
        (w): w is FileWindow => w.kind === "file" && w.filePath === filePath,
      );
      if (existingWindow) {
        windowStore.focusWindow(existingWindow.id);
        return;
      }

      // Create new file window
      const win = windowStore.createWindow(
        { kind: "file", filePath },
        activeWorktreePath ?? undefined,
      );

      // Load file content
      setFileContents((prev) => {
        const next = new Map(prev);
        next.set(win.id, { content: null, isLoading: true, error: null });
        return next;
      });

      try {
        const result = await window.pidesk.fs.readFile(filePath);
        setFileContents((prev) => {
          const next = new Map(prev);
          const existing = next.get(win.id);
          if (existing) {
            next.set(win.id, {
              ...existing,
              content: result,
              isLoading: false,
            });
          }
          return next;
        });
      } catch (error) {
        setFileContents((prev) => {
          const next = new Map(prev);
          const existing = next.get(win.id);
          if (existing) {
            next.set(win.id, {
              ...existing,
              error:
                error instanceof Error ? error.message : "Failed to load file",
              isLoading: false,
            });
          }
          return next;
        });
      }
    },
    [windowState.layout.windows, windowStore, activeWorktreePath],
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
    setNoteContents((prev) => {
      const next = new Map(prev);
      next.set(noteWindow.id, { content: "", error: null });
      return next;
    });
    if (activeThreadId) {
      windowStore.updateWindow(noteWindow.id, {
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
    setSearchUiState((prev) => {
      const next = new Map(prev);
      next.set(searchWindow.id, { isLoading: false, selectedIndex: -1 });
      return next;
    });
  }, [activeWorktreePath, windowState.layout.windows, windowStore]);

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
      setFileContents((prev) => {
        const next = new Map(prev);
        const existing = next.get(windowId);
        if (existing && existing.content?.type === "text") {
          next.set(windowId, {
            ...existing,
            content: { ...existing.content, content: newContent },
          });
        }
        return next;
      });
      windowStore.setDirty(windowId, true);
    },
    [windowStore],
  );

  const handleFileSave = React.useCallback(
    async (windowId: string, filePath: string) => {
      const fileData = fileContents.get(windowId);
      if (!fileData?.content || fileData.content.type !== "text") return;

      try {
        await window.pidesk.fs.writeFile(filePath, fileData.content.content);
        windowStore.setDirty(windowId, false);
      } catch (error) {
        console.error("Failed to save file:", error);
      }
    },
    [fileContents, windowStore],
  );

  const handleNoteContentChange = React.useCallback(
    (windowId: string, newContent: string) => {
      setNoteContents((prev) => {
        const next = new Map(prev);
        const existing = next.get(windowId) ?? { content: "", error: null };
        next.set(windowId, { ...existing, content: newContent });
        return next;
      });
      windowStore.setDirty(windowId, true);
    },
    [windowStore],
  );

  const handleNoteSave = React.useCallback(
    async (windowId: string, storagePath?: string) => {
      if (!storagePath) {
        return;
      }
      const noteData = noteContents.get(windowId);
      if (!noteData) {
        return;
      }

      try {
        await window.pidesk.fs.writeFile(storagePath, noteData.content);
        windowStore.setDirty(windowId, false);
      } catch (error) {
        console.error("Failed to save note:", error);
      }
    },
    [noteContents, windowStore],
  );

  const handleSearchQueryChange = React.useCallback(
    async (windowId: string, query: string) => {
      windowStore.updateWindow(windowId, { query, results: [] });
      const requestVersion =
        (searchRequestVersionsRef.current.get(windowId) ?? 0) + 1;
      searchRequestVersionsRef.current.set(windowId, requestVersion);
      setSearchUiState((prev) => {
        const next = new Map(prev);
        next.set(windowId, { isLoading: true, selectedIndex: -1 });
        return next;
      });

      if (!query.trim() || !activeWorktreePath) {
        setSearchUiState((prev) => {
          const next = new Map(prev);
          next.set(windowId, { isLoading: false, selectedIndex: -1 });
          return next;
        });
        return;
      }

      try {
        const response = await window.pidesk.search.searchFiles({
          query,
          rootPath: activeWorktreePath,
          maxResults: 20,
        });
        if (searchRequestVersionsRef.current.get(windowId) !== requestVersion) {
          return;
        }
        windowStore.updateWindow(windowId, {
          query,
          results: response.results,
        });
        setSearchUiState((prev) => {
          const next = new Map(prev);
          next.set(windowId, {
            isLoading: false,
            selectedIndex: response.results.length > 0 ? 0 : -1,
          });
          return next;
        });
      } catch (error) {
        console.error("Failed to search workspace:", error);
        setSearchUiState((prev) => {
          const next = new Map(prev);
          next.set(windowId, { isLoading: false, selectedIndex: -1 });
          return next;
        });
      }
    },
    [activeWorktreePath, windowStore],
  );

  const handleSearchSelect = React.useCallback(
    (match: SearchMatch) => {
      if (match.type === "file") {
        void handleFileClick(match.path);
        return;
      }
      setSidebarView("files");
    },
    [handleFileClick],
  );

  const handleSearchHover = React.useCallback(
    (windowId: string, index: number) => {
      setSearchUiState((prev) => {
        const next = new Map(prev);
        const existing = next.get(windowId) ?? {
          isLoading: false,
          selectedIndex: -1,
        };
        next.set(windowId, { ...existing, selectedIndex: index });
        return next;
      });
    },
    [],
  );

  const handleSearchKeyDown = React.useCallback(
    (windowId: string) => (event: React.KeyboardEvent<HTMLInputElement>) => {
      const searchWindow = windowState.layout.windows.find(
        (w): w is SearchWindow => w.id === windowId && w.kind === "search",
      );
      if (!searchWindow) {
        return;
      }
      const selectedIndex = searchUiState.get(windowId)?.selectedIndex ?? -1;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSearchUiState((prev) => {
          const next = new Map(prev);
          const nextIndex =
            searchWindow.results.length === 0
              ? -1
              : (selectedIndex + 1) % searchWindow.results.length;
          next.set(windowId, { isLoading: false, selectedIndex: nextIndex });
          return next;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSearchUiState((prev) => {
          const next = new Map(prev);
          const nextIndex =
            searchWindow.results.length === 0
              ? -1
              : (selectedIndex - 1 + searchWindow.results.length) %
                searchWindow.results.length;
          next.set(windowId, { isLoading: false, selectedIndex: nextIndex });
          return next;
        });
        return;
      }

      if (event.key === "Enter") {
        const selectedMatch =
          selectedIndex >= 0 ? searchWindow.results[selectedIndex] : undefined;
        if (selectedMatch) {
          event.preventDefault();
          handleSearchSelect(selectedMatch);
        }
      }
    },
    [handleSearchSelect, searchUiState, windowState.layout.windows],
  );
  const handleAddRepository = React.useCallback(async () => {
    const paths = await window.pidesk.dialog.showOpenDialog({
      properties: ["openDirectory", "multiSelections"],
      title: "Add Repository",
    });
    if (!paths || paths.length === 0) return;
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
    setNewWorktreeBranch("");
    setIsCreateWorktreeOpen(true);
  }, []);

  const submitCreateWorktree = React.useCallback(async () => {
    if (!newWorktreeBranch.trim()) return;

    let repositoryId = activeRepositoryId;
    if (!repositoryId) {
      const freshShell = await window.pidesk.shell.getSnapshot();
      repositoryId = getActiveRepository(freshShell)?.id ?? null;
    }

    if (!repositoryId) return;

    try {
      await window.pidesk.worktrees.create(
        repositoryId,
        newWorktreeBranch.trim(),
      );
      setIsCreateWorktreeOpen(false);
      setNewWorktreeBranch("");
      setWorktreeCreateError(null);
      await reload();
    } catch (error) {
      setWorktreeCreateError(
        error instanceof Error ? error.message : "Failed to create worktree",
      );
    }
  }, [activeRepositoryId, newWorktreeBranch, reload]);

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
    async (focusedWindow: import("@pidesk/shared").CanvasWindow) => {
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

  const loadModelState = React.useCallback(async () => {
    try {
      const [providers, settings] = await Promise.all([
        window.pidesk.agent.getProviders(),
        window.pidesk.agent.getSettings(),
      ]);
      setProviderSnapshots(providers);
      setSettingsSnapshot(settings);
    } catch (error) {
      console.error("Failed to load model state:", error);
    }
  }, []);

  React.useEffect(() => {
    void loadModelState();
  }, [loadModelState]);

  React.useEffect(() => {
    let disposed = false;

    async function loadAutocomplete() {
      if (!autocompleteMatch) {
        setAutocompleteSuggestions([]);
        setAutocompleteSelectedIndex(0);
        return;
      }

      if (autocompleteMatch.trigger === "/") {
        try {
          const response = await window.pidesk.agent.getSlashSuggestions({
            text: draft,
            cursorPosition: draft.length,
            trigger: "/",
            query: autocompleteMatch.query,
          });
          if (!disposed) {
            setAutocompleteSuggestions(response.suggestions);
            setAutocompleteSelectedIndex(
              response.suggestions.length > 0 ? 0 : -1,
            );
          }
        } catch (error) {
          console.error("Failed to load slash suggestions:", error);
          if (!disposed) {
            setAutocompleteSuggestions([]);
            setAutocompleteSelectedIndex(-1);
          }
        }
        return;
      }

      let fileSearchResults: SearchMatch[] = [];
      if (activeWorktreePath && autocompleteMatch.query.trim().length > 0) {
        try {
          const searchResponse = await window.pidesk.search.searchFiles({
            query: autocompleteMatch.query,
            rootPath: activeWorktreePath,
            maxResults: 8,
          });
          fileSearchResults = searchResponse.results;
        } catch (error) {
          console.error("Failed to load file mentions:", error);
        }
      }

      const mentionSuggestions = buildMentionSuggestions({
        windows: windowState.layout.windows,
        fileSearchResults,
        query: autocompleteMatch.query,
      });

      if (!disposed) {
        setAutocompleteSuggestions(mentionSuggestions);
        setAutocompleteSelectedIndex(mentionSuggestions.length > 0 ? 0 : -1);
      }
    }

    void loadAutocomplete();

    return () => {
      disposed = true;
    };
  }, [
    autocompleteMatch,
    activeWorktreePath,
    draft,
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
      setAutocompleteSuggestions([]);
      setAutocompleteSelectedIndex(-1);
    },
    [autocompleteMatch, draft, setDraft],
  );

  const handlePromptKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!autocompleteMatch || autocompleteSuggestions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setAutocompleteSelectedIndex((current) =>
          current < autocompleteSuggestions.length - 1 ? current + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setAutocompleteSelectedIndex((current) =>
          current > 0 ? current - 1 : autocompleteSuggestions.length - 1,
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
        setAutocompleteSuggestions([]);
        setAutocompleteSelectedIndex(-1);
      }
    },
    [
      autocompleteMatch,
      autocompleteSelectedIndex,
      autocompleteSuggestions,
      handleAutocompleteSelect,
    ],
  );

  const handleModelSelection = React.useCallback(
    async (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selection = parseModelSelectionValue(event.target.value);
      if (!selection) {
        return;
      }

      dispatchModelSelectionState({ type: "start" });
      try {
        await window.pidesk.agent.switchModel(selection);
        await loadModelState();
        await reload();
      } catch (error) {
        console.error("Failed to switch model:", error);
      } finally {
        dispatchModelSelectionState({ type: "finish" });
      }
    },
    [loadModelState, reload],
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
    sendPrompt();
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

  return (
    <SettingsProvider>
      <TooltipProvider>
        <div
          data-testid="app-ready"
          className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        >
          <TitleBar
            sidebarView={sidebarView}
            setSidebarView={setSidebarView}
            hasOpenNotes={hasOpenNotes}
            onOpenLauncher={handleOpenLauncher}
            onOpenNote={handleOpenNote}
            onOpenGit={handleOpenGit}
            onOpenTerminal={handleOpenTerminal}
          />

          <div className="relative flex min-h-0 flex-1">
            {/* Extended grid background - covers full viewport */}
            <div
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.25]"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px), radial-gradient(circle, rgba(0,0,0,0.3) 1px, transparent 1px)`,
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 8px 8px",
              }}
            />
            {/* Three-panel layout */}
            <LeftRail
              repositories={repositories}
              activeRepositoryId={activeRepositoryId}
              onSelectRepository={handleSelectRepository}
              onAddRepository={handleAddRepository}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            <LeftSidebar
              repository={activeRepository}
              activeWorktreeId={activeWorktreeId}
              activeThreadId={activeThreadId}
              onSelectWorktree={handleSelectWorktree}
              onSelectThread={handleSelectThread}
              onCreateThread={handleCreateThread}
              onCreateWorktree={handleCreateWorktree}
              onShowArchived={() => {}}
              width={leftSidebarWidth}
              onResize={handleLeftSidebarResize}
              className="z-10"
            />

            {/* Main panel */}
            <main className="relative z-10 flex min-w-0 flex-1 flex-col">
              {/* Content area */}
              <div className="relative min-h-0 flex-1">
                <CanvasContainer
                  className="h-full"
                  onWindowFocus={(window) => {
                    void handleWindowFocus(window);
                  }}
                  renderWindowContent={(win) => (
                    <WindowContentRouter
                      win={win}
                      activeThreadId={activeThreadId}
                      agent={{
                        messages: agent.messages,
                        status: agent.status,
                        lastError: agent.lastError,
                      }}
                      threadLookup={threadLookup}
                      threadConversations={threadConversations}
                      fileContents={fileContents}
                      noteContents={noteContents}
                      searchUiState={searchUiState}
                      graphNodes={graphNodes}
                      graphLinks={graphLinks}
                      onFileContentChange={handleFileContentChange}
                      onFileSave={handleFileSave}
                      onNoteContentChange={handleNoteContentChange}
                      onNoteSave={handleNoteSave}
                      onSearchQueryChange={handleSearchQueryChange}
                      onSearchSelect={handleSearchSelect}
                      onSearchHover={handleSearchHover}
                      onSearchKeyDown={handleSearchKeyDown}
                      onOpenTerminal={handleOpenTerminal}
                      onOpenGit={handleOpenGit}
                      onOpenNote={handleOpenNote}
                      onOpenGraph={handleOpenGraph}
                    />
                  )}
                />
                {windowState.layout.windows.length === 0 ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8">
                    <div className="max-w-md rounded-2xl border border-dashed border-border bg-surface-1/80 px-6 py-5 text-center shadow-sm backdrop-blur-sm">
                      <h2 className="text-base font-semibold text-foreground">
                        Open threads in their own windows
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {activeThreadId
                          ? "Click a thread in the left sidebar, or send a message, to open or refocus its chat window here."
                          : "Select a thread in the left sidebar to open its dedicated chat window."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Input area */}
              <PromptDock
                draft={draft}
                onDraftChange={setDraft}
                onSend={handleSend}
                activeThreadId={activeThreadId}
                activeThreadTitle={
                  activeThread ? getThreadWindowTitle(activeThread) : null
                }
                canSend={canSend}
                autocompleteSuggestions={autocompleteSuggestions}
                autocompleteSelectedIndex={autocompleteSelectedIndex}
                onAutocompleteSelect={handleAutocompleteSelect}
                onAutocompleteHover={setAutocompleteSelectedIndex}
                onPromptKeyDown={handlePromptKeyDown}
                displayAgentStatus={displayAgentStatus}
                runtimeModeLabel={runtimeModeLabel}
                providerSnapshots={providerSnapshots}
                currentModelValue={currentModelValue}
                isSwitchingModel={isSwitchingModel}
                onModelSelection={handleModelSelection}
              />
            </main>

            {/* Right sidebar */}
            {sidebarView === "files" ? (
              <aside className="relative z-10 flex h-full w-64 shrink-0 flex-col border-l border-border bg-surface-1">
                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-2">
                    <FileTree
                      rootPath={activeWorktreePath}
                      onFileClick={handleFileClick}
                    />
                  </div>
                </ScrollArea>
              </aside>
            ) : null}

            {/* Create worktree dialog */}
            <Dialog
              open={isCreateWorktreeOpen}
              onOpenChange={setIsCreateWorktreeOpen}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create worktree</DialogTitle>
                  <DialogDescription>
                    Start a new git worktree from the active repository branch.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-4">
                  <input
                    data-testid="worktree-branch-input"
                    value={newWorktreeBranch}
                    onChange={(e) => setNewWorktreeBranch(e.target.value)}
                    placeholder="feature/my-task"
                    className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-hover"
                  />
                  {worktreeCreateError && (
                    <p className="text-sm text-destructive">
                      {worktreeCreateError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsCreateWorktreeOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void submitCreateWorktree()}
                      disabled={!newWorktreeBranch.trim()}
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Settings modal */}
            <SettingsModal
              open={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
            />
          </div>
        </div>
      </TooltipProvider>
    </SettingsProvider>
  );
}
