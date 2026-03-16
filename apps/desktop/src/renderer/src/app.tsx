"use client";

import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  getActiveRepository,
  getActiveThread,
  getActiveWorktree,
} from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
  TooltipProvider,
} from "@pidesk/ui";
import {
  ArrowUp,
  FolderTree,
  GitBranch,
  StickyNote,
  Terminal,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
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
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "./components/ui/message";
import {
  MultiFileViewer,
  type OpenFile,
} from "./components/ui/multi-file-viewer";
import { ScrollArea } from "./components/ui/scroll-area";
import { WorkspaceNotes } from "./components/ui/workspace-notes";
import { LeftRail } from "./components/workspace/left-rail";
import { LeftSidebar } from "./components/workspace/left-sidebar";
import { useShellModel } from "./hooks/use-shell-model";

function getMessageLabel(message: AgentMessageSnapshot) {
  switch (message.role) {
    case "assistant":
      return "PiDesk";
    case "tool":
      return "Tool";
    case "system":
      return "System";
    default:
      return "You";
  }
}

function getMessageFallback(message: AgentMessageSnapshot) {
  switch (message.role) {
    case "assistant":
      return "π";
    case "tool":
      return "{}";
    case "system":
      return "•";
    default:
      return "U";
  }
}

function TitleBar() {
  return (
    <div
      data-drag-region="true"
      className="titlebar relative flex h-10 shrink-0 items-center justify-center bg-surface-1"
    >
      <div
        aria-hidden="true"
        data-testid="app-title"
        className="text-lg font-semibold tracking-tight text-muted-foreground"
      >
        π
      </div>
    </div>
  );
}

export default function App() {
  const { reload, sendPrompt, setDraft, state } = useShellModel();
  const { agent, draft, shell } = state;
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

  const [openFiles, setOpenFiles] = React.useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
    null,
  );
  const [isTerminalOpen, setIsTerminalOpen] = React.useState(false);
  const [isTerminalActive, setIsTerminalActive] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isCreateWorktreeOpen, setIsCreateWorktreeOpen] = React.useState(false);
  const [newWorktreeBranch, setNewWorktreeBranch] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<
    string | null
  >(null);
  const [terminalId] = React.useState(() => `terminal-${Date.now()}`);
  const [sidebarView, setSidebarView] = React.useState<
    "files" | "git" | "notes"
  >("files");
  const [workspaceNotes, setWorkspaceNotes] = React.useState("");
  const [isNotesOpen, setIsNotesOpen] = React.useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(() => {
    if (typeof window === "undefined") return 180;
    const saved = localStorage.getItem("pidesk.leftSidebarWidth");
    return saved ? Math.max(140, Math.min(400, Number(saved))) : 180;
  });

  const handleLeftSidebarResize = React.useCallback((width: number) => {
    setLeftSidebarWidth(width);
    localStorage.setItem("pidesk.leftSidebarWidth", String(width));
  }, []);

  const canSend =
    draft.trim().length > 0 &&
    activeThreadId !== null &&
    agent.status !== "starting" &&
    agent.status !== "streaming";

  const loadFile = React.useCallback(
    async (filePath: string) => {
      const existingFile = openFiles.find((file) => file.path === filePath);
      if (existingFile) {
        setActiveFilePath(filePath);
        setIsTerminalActive(false);
        return;
      }
      setOpenFiles((prev) => [
        ...prev,
        { path: filePath, content: null, isLoading: true, error: null },
      ]);
      setActiveFilePath(filePath);
      setIsTerminalActive(false);
      try {
        const result = await window.pidesk.fs.readFile(filePath);
        setOpenFiles((prev) =>
          prev.map((file) =>
            file.path === filePath
              ? { ...file, content: result, isLoading: false }
              : file,
          ),
        );
      } catch (error) {
        setOpenFiles((prev) =>
          prev.map((file) =>
            file.path === filePath
              ? {
                  ...file,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Failed to load file",
                  isLoading: false,
                }
              : file,
          ),
        );
      }
    },
    [openFiles],
  );

  const handleFileClick = React.useCallback(
    (filePath: string) => {
      void loadFile(filePath);
    },
    [loadFile],
  );
  const handleTabClick = React.useCallback((filePath: string) => {
    setActiveFilePath(filePath);
    setIsTerminalActive(false);
  }, []);
  const handleTabClose = React.useCallback(
    (filePath: string) => {
      setOpenFiles((prev) => {
        const nextFiles = prev.filter((file) => file.path !== filePath);
        if (activeFilePath === filePath && nextFiles.length > 0) {
          const index = prev.findIndex((file) => file.path === filePath);
          setActiveFilePath(nextFiles[Math.max(0, index - 1)]?.path ?? null);
        } else if (nextFiles.length === 0) {
          setActiveFilePath(null);
        }
        return nextFiles;
      });
    },
    [activeFilePath],
  );
  const handleCloseAllFiles = React.useCallback(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
  }, []);

  React.useEffect(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
    setIsTerminalOpen(false);
    setIsTerminalActive(false);
  }, [activeWorktreePath]);

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
    if (!activeRepositoryId || !newWorktreeBranch.trim()) return;
    try {
      await window.pidesk.worktrees.create(
        activeRepositoryId,
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
      setIsTerminalActive(false);
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
      setIsTerminalActive(false);
      await reload();
    },
    [reload],
  );

  const handleSend = React.useCallback(() => {
    if (!canSend) return;
    sendPrompt();
  }, [canSend, sendPrompt]);

  const runtimeMode = shell.runtime?.agentMode ?? "unknown";
  const runtimeModeLabel = `${runtimeMode} mode`;

  return (
    <SettingsProvider>
      <TooltipProvider>
        <div
          data-testid="app-ready"
          className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
        >
          <TitleBar />

          <div className="relative flex min-h-0 flex-1">
            {/* Extended grid background - covers full viewport */}
            <div
              className="pointer-events-none absolute inset-0 z-0 opacity-[0.25]"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px), radial-gradient(circle, rgba(0,0,0,0.3) 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px',
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
              {openFiles.length > 0 || isTerminalOpen ? (
                <MultiFileViewer
                  openFiles={openFiles}
                  activeFilePath={activeFilePath}
                  onTabClick={handleTabClick}
                  onTabClose={handleTabClose}
                  onCloseAll={handleCloseAllFiles}
                  className="min-h-0 flex-1"
                  isTerminalOpen={isTerminalOpen}
                  isTerminalActive={isTerminalActive}
                  onTerminalClick={() => setIsTerminalActive(true)}
                  onTerminalClose={() => {
                    setIsTerminalOpen(false);
                    setIsTerminalActive(false);
                  }}
                  terminalCwd={activeWorktreePath ?? undefined}
                  terminalId={terminalId}
                />
              ) : (
                <ChatContainerRoot className="relative min-h-0 flex-1">
                  <ChatContainerContent
                    data-testid="chat-transcript"
                    className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-40 pt-10"
                  >
                    {agent.messages.length > 0 && (
                      agent.messages.map((message) => {
                        const isSystem = message.role === "system";
                        return (
                          <Message
                            key={message.id}
                            className={cn(isSystem && "my-6 justify-center")}
                          >
                            {!isSystem && (
                              <MessageAvatar
                                src=""
                                alt={getMessageLabel(message)}
                                fallback={getMessageFallback(message)}
                              />
                            )}
                            <div
                              className={cn(
                                "min-w-0 flex-1",
                                isSystem && "flex-initial",
                              )}
                            >
                              {!isSystem && (
                                <span className="text-sm font-medium text-muted-foreground">
                                  {getMessageLabel(message)}
                                </span>
                              )}
                              {isSystem ? (
                                <div className="mt-1 rounded border border-dashed border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                                  {message.text}
                                </div>
                              ) : (
                                <MessageContent
                                  markdown={message.role !== "user"}
                                  className="mt-1 max-w-none bg-transparent p-0 text-base leading-relaxed text-foreground shadow-none"
                                >
                                  {message.text || " "}
                                </MessageContent>
                              )}
                            </div>
                          </Message>
                        );
                      })
                    )}
                    {agent.status === "streaming" && (
                      <div className="pl-11 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        PiDesk is responding
                      </div>
                    )}
                    {agent.lastError && (
                      <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                        {agent.lastError}
                      </div>
                    )}
                    <ChatContainerScrollAnchor />
                  </ChatContainerContent>
                </ChatContainerRoot>
              )}

              {/* Input area */}
              <div className="relative z-20 bg-gradient-to-t from-background to-transparent pb-6 pt-4">
                <div className="mx-auto max-w-4xl px-6">
                  <PromptInput
                    value={draft}
                    onValueChange={setDraft}
                    onSubmit={handleSend}
                    className="rounded-xl border border-border bg-transparent p-4 shadow-lg transition focus-within:border-border-hover focus-within:bg-surface-3 focus-within:shadow-xl"
                  >
                    <PromptInputTextarea
                      data-testid="chat-input"
                      placeholder={
                        activeThreadId
                          ? "Ask Pi..."
                          : "Select a thread to start..."
                      }
                      disabled={!activeThreadId}
                      className="min-h-24 resize-none border-0 bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-50"
                    />
                    <PromptInputActions className="mt-3 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-border bg-surface-1 px-2 py-1 text-[10px] text-muted-foreground">
                          {runtimeModeLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[0.7rem] text-zinc-500">
                          Enter to send
                        </span>
                        <PromptInputAction tooltip="Send message">
                          <Button
                            type="button"
                            data-testid="chat-send"
                            variant="ghost"
                            size="icon"
                            disabled={!canSend}
                            onClick={handleSend}
                            className="size-8 rounded-lg border border-white/8 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.10] disabled:opacity-50"
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                        </PromptInputAction>
                      </div>
                    </PromptInputActions>
                  </PromptInput>
                </div>
              </div>
            </main>

            {/* Right sidebar - File tree - floating style */}
            <aside className="relative z-10 m-3 flex w-64 shrink-0 flex-col rounded-xl border border-border shadow-xl">
              {/* Icon header */}
              <header className="flex h-11 shrink-0 items-center justify-center gap-1 border-b border-border bg-surface-2 px-2">
                <button
                  type="button"
                  onClick={() => setSidebarView("files")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    sidebarView === "files"
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:bg-surface-3/50 hover:text-foreground",
                  )}
                  title="Files"
                >
                  <FolderTree className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarView("git")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    sidebarView === "git"
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:bg-surface-3/50 hover:text-foreground",
                  )}
                  title="Git"
                >
                  <GitBranch className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsNotesOpen(true)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    isNotesOpen
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:bg-surface-3/50 hover:text-foreground",
                  )}
                  title="Workspace Notes"
                >
                  <StickyNote className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTerminalOpen(true);
                    setIsTerminalActive(true);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    isTerminalOpen
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:bg-surface-3/50 hover:text-foreground",
                  )}
                  title="Terminal"
                >
                  <Terminal className="size-4" />
                </button>
              </header>
              <ScrollArea className="min-h-0 flex-1">
                {sidebarView === "files" && (
                  <div className="p-2">
                    <FileTree
                      rootPath={activeWorktreePath}
                      onFileClick={handleFileClick}
                    />
                  </div>
                )}
                {sidebarView === "git" && (
                  <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                    <GitBranch className="mb-2 size-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Git integration coming soon
                    </p>
                  </div>
                )}
              </ScrollArea>
            </aside>

            {/* Workspace Notes Tab */}
            {isNotesOpen && (
              <div className="absolute right-64 top-10 bottom-0 z-20 w-96 border-l border-border bg-background shadow-xl">
                <div className="flex h-full flex-col">
                  <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Workspace Notes
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNotesOpen(false)}
                      className="rounded px-2 py-1 text-xs text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
                    >
                      Close
                    </button>
                  </header>
                  <WorkspaceNotes
                    content={workspaceNotes}
                    onChange={setWorkspaceNotes}
                    className="min-h-0 flex-1"
                  />
                </div>
              </div>
            )}

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
