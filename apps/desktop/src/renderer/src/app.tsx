"use client";
import type {
  AgentMessageSnapshot,
  FileContent,
  RepositorySnapshot,
  ShellGitSnapshot,
} from "@pidesk/shared";
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
  Todo,
  type TodoItem,
  TooltipProvider,
} from "@pidesk/ui";
import {
  ArrowUp,
  ChevronDown,
  FileText,
  Folder,
  FolderGit,
  FolderTree,
  GitBranch,
  History,
  MessageSquare,
  Plus,
  Settings2,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Terminal } from "./components/ui/terminal";
import { GitStatusChip } from "./components/workspace/git-status-chip";
import { RepositorySwitcher } from "./components/workspace/repository-switcher";
import { RuntimeStatusChip } from "./components/workspace/runtime-status-chip";
import { ThreadList } from "./components/workspace/thread-list";
import { WorktreeList } from "./components/workspace/worktree-list";
import { useShellModel } from "./hooks/use-shell-model";
import { SettingsProvider, SettingsModal } from "./components/settings";

const UI_FONT_OPTIONS = [
  {
    value: '"SF Pro Display", "DM Sans", ui-sans-serif, system-ui, sans-serif',
    label: "Display Sans",
  },
  {
    value: '"DM Sans", "SF Pro Display", ui-sans-serif, system-ui, sans-serif',
    label: "DM Sans",
  },
  {
    value: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    label: "System",
  },
];

const CODE_FONT_OPTIONS = [
  {
    value: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
    label: "SF Mono",
  },
  {
    value: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
    label: "JetBrains Mono",
  },
  {
    value: 'Menlo, "SF Mono", ui-monospace, monospace',
    label: "Menlo",
  },
];

type InspectorView = "git" | "worktrees" | "context" | "history";

const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function readStoredValue(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return "Just now";
  }

  return timeFormatter.format(new Date(timestamp));
}
function getPathTail(value?: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

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

function formatActivityType(type: string) {
  return type.replace(/_/g, " ");
}

function buildTodoItems(options: {
  activityCount: number;
  hasAssistantReply: boolean;
  hasWorkspace: boolean;
  gitStatus?: ShellGitSnapshot["status"];
  status: string;
}): TodoItem[] {
  const { activityCount, gitStatus, hasAssistantReply, hasWorkspace, status } =
    options;

  if (activityCount === 0 && !hasAssistantReply && status !== "streaming") {
    return [];
  }

  return [
    {
      id: "workspace",
      text: "Load workspace metadata",
      completed: hasWorkspace,
    },
    {
      id: "git",
      text: "Attach repository context",
      completed: gitStatus === "repository",
    },
    {
      id: "reply",
      text:
        status === "streaming"
          ? "Respond to current prompt"
          : "Prompt response available",
      completed: hasAssistantReply && status !== "streaming",
    },
  ];
}

function SettingsSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-sm text-foreground outline-none transition hover:border-border-hover"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlySelector({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground"
        >
          {label}
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 rounded border border-border bg-popover p-3"
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Read only
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function GitInspector({ git }: { git?: ShellGitSnapshot }) {
  if (!git || git.status === "not_repo") {
    return (
      <section className="space-y-2">
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              No repository
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This workspace is not inside a git repository.
          </p>
        </div>
      </section>
    );
  }

  if (git.status === "unavailable") {
    return (
      <section className="space-y-2">
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Git unavailable
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {git.message ?? "The desktop shell could not inspect git state."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="rounded border border-border bg-surface-2 p-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {getPathTail(git.rootPath)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {git.branch ?? "detached"} • {git.hasChanges ? "changed" : "clean"}
        </p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <span>Commit</span>
            <span className="truncate text-foreground/80">
              {git.commit ?? "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Changes</span>
            <span className="text-foreground/80">
              {git.stagedCount ?? 0}/{git.modifiedCount ?? 0}/
              {git.untrackedCount ?? 0}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Sync</span>
            <span className="text-foreground/80">
              +{git.ahead ?? 0} / -{git.behind ?? 0}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorktreeInspector({
  repositories,
  activeRepositoryId,
  activeWorktreeId,
}: {
  repositories: RepositorySnapshot[];
  activeRepositoryId: string | null;
  activeWorktreeId: string | null;
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Worktrees</p>
      <div className="space-y-3">
        {repositories.map((repository) => (
          <div
            key={repository.id}
            className={cn(
              "rounded border p-3 text-sm",
              repository.id === activeRepositoryId
                ? "border-border-hover bg-surface-2"
                : "border-border bg-surface-1",
            )}
          >
            <div className="font-medium text-foreground">{repository.name}</div>
            <div className="mt-0.5 break-words text-xs text-muted-foreground">
              {repository.rootPath}
            </div>
            <div className="mt-3 space-y-2">
              {repository.worktrees.map((worktree) => (
                <div
                  key={worktree.id}
                  className={cn(
                    "rounded border px-3 py-2",
                    worktree.id === activeWorktreeId
                      ? "border-border-hover bg-surface-3"
                      : "border-border bg-surface-1",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">
                        {worktree.label}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {worktree.path}
                      </div>
                    </div>
                    <GitStatusChip git={worktree.git} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContextInspector({
  lastError,
  runtimeMode,
  supportsActivity,
  supportsParallelSessions,
  supportsTools,
  supportsTurns,
  repositoryName,
  threadTitle,
  worktreePath,
}: {
  lastError: string | null;
  runtimeMode?: string;
  supportsActivity?: boolean;
  supportsParallelSessions?: boolean;
  supportsTools?: boolean;
  supportsTurns?: boolean;
  repositoryName?: string | null;
  threadTitle?: string | null;
  worktreePath?: string | null;
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Context</p>
      <div className="rounded border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
        <div className="flex justify-between gap-2">
          <span>Agent mode</span>
          <span className="capitalize text-foreground/80">
            {runtimeMode ?? "unknown"}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span>Repository</span>
          <span className="truncate text-foreground/80">
            {repositoryName ?? "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Worktree</span>
          <span className="truncate text-foreground/80">
            {worktreePath ?? "—"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Thread</span>
          <span className="truncate text-foreground/80">
            {threadTitle ?? "—"}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span>Turns</span>
          <span className="text-foreground/80">
            {supportsTurns ? "on" : "off"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Tools</span>
          <span className="text-foreground/80">
            {supportsTools ? "on" : "off"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Activity</span>
          <span className="text-foreground/80">
            {supportsActivity ? "on" : "off"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Parallel</span>
          <span className="text-foreground/80">
            {supportsParallelSessions ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="rounded border border-border bg-surface-2 p-3 text-sm leading-relaxed text-muted-foreground">
        {lastError ?? "No additional context loaded"}
      </div>
    </section>
  );
}

function HistoryInspector({
  items,
}: {
  items: { id: string; timestamp: number; type: string }[];
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">History</p>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded px-2 py-1 text-sm text-muted-foreground"
            >
              <div>{formatActivityType(item.type)}</div>
              <div className="text-xs text-foreground/50">
                {formatTimestamp(item.timestamp)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
          No activity yet
        </div>
      )}
    </section>
  );
}

function TitleBar() {
  return (
    <div
      data-drag-region="true"
      className="titlebar relative flex h-10 shrink-0 items-center justify-center border-b border-border bg-surface-1"
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
  const { agent, draft, live, shell } = state;
  const activeRepository = React.useMemo(() => getActiveRepository(shell), [shell]);
  const activeWorktree = React.useMemo(() => getActiveWorktree(shell), [shell]);
  const activeThread = React.useMemo(() => getActiveThread(shell), [shell]);
  const repositories = shell.catalog.repositories;
  const worktrees = activeRepository?.worktrees ?? [];
  const threads = activeWorktree?.threads ?? [];
  const activeRepositoryId = activeRepository?.id ?? null;
  const activeWorktreeId = activeWorktree?.id ?? null;
  const activeWorktreePath = activeWorktree?.path ?? null;
  const activeThreadId = activeThread?.id ?? null;

  const [activeView, setActiveView] = React.useState<InspectorView>("git");
  const [interfaceFont, setInterfaceFont] = React.useState(() =>
    readStoredValue("pidesk-font-sans", UI_FONT_OPTIONS[0]?.value ?? "Inter"),
  );
  const [codeFont, setCodeFont] = React.useState(() =>
    readStoredValue(
      "pidesk-font-mono",
      CODE_FONT_OPTIONS[0]?.value ?? "JetBrains Mono",
    ),
  );
  const [openFiles, setOpenFiles] = React.useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
    null,
  );
  const [isTerminalOpen, setIsTerminalOpen] = React.useState(false);
  const [isTerminalActive, setIsTerminalActive] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isCreateWorktreeOpen, setIsCreateWorktreeOpen] = React.useState(false);
  const [newWorktreeBranch, setNewWorktreeBranch] = React.useState("");
  const [worktreeCreateError, setWorktreeCreateError] = React.useState<string | null>(
    null,
  );
  const [terminalId] = React.useState(() => `terminal-${Date.now()}`);

  const activityItems = React.useMemo(
    () => [...live.activity].slice(-6).reverse(),
    [live.activity],
  );
  const todoItems = React.useMemo(
    () =>
      buildTodoItems({
        activityCount: live.activity.length,
        gitStatus: activeWorktree ? "repository" : shell.git?.status,
        hasAssistantReply: agent.messages.some(
          (message) => message.role === "assistant",
        ),
        hasWorkspace: Boolean(activeWorktreePath),
        status: agent.status,
      }),
    [
      activeWorktree,
      activeWorktreePath,
      agent.messages,
      agent.status,
      live.activity.length,
      shell.git?.status,
    ],
  );

  const canSend =
    draft.trim().length > 0 &&
    activeThreadId !== null &&
    agent.status !== "starting" &&
    agent.status !== "streaming";
  const runtimeMode = shell.runtime?.agentMode ?? "unknown";
  const runtimeModeLabel = `${runtimeMode} mode`;

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
                    error instanceof Error ? error.message : "Failed to load file",
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
          const nextFile = nextFiles[Math.max(0, index - 1)];
          setActiveFilePath(nextFile?.path ?? null);
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

  function handleTextSelect(selection: {
    text: string;
    startLine: number;
    endLine: number;
    filename: string;
    filePath: string;
  }): void {
    const lineRef =
      selection.startLine === selection.endLine
        ? `L${selection.startLine}`
        : `L${selection.startLine}-L${selection.endLine}`;
    const formatted = `${selection.filePath}:${lineRef}\n\`\`\`\n${selection.text}\n\`\`\``;
    setDraft(draft ? `${draft}\n\n${formatted}` : formatted);
  }

  React.useEffect(() => {
    setOpenFiles([]);
    setActiveFilePath(null);
    setIsTerminalOpen(false);
    setIsTerminalActive(false);
  }, [activeWorktreePath]);


  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-sans",
      interfaceFont,
    );
    document.documentElement.style.setProperty("--app-font-mono", codeFont);
    window.localStorage.setItem("pidesk-font-sans", interfaceFont);
    window.localStorage.setItem("pidesk-font-mono", codeFont);
  }, [codeFont, interfaceFont]);

  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 400;
  const DEFAULT_LEFT_WIDTH = 320;
  const DEFAULT_RIGHT_WIDTH = 250;

  const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(() => {
    try {
      const stored = window.localStorage.getItem("pidesk-left-sidebar-width");
      return stored
        ? Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, Number(stored)),
          )
        : DEFAULT_LEFT_WIDTH;
    } catch {
      return DEFAULT_LEFT_WIDTH;
    }
  });
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(() => {
    try {
      const stored = window.localStorage.getItem("pidesk-right-sidebar-width");
      return stored
        ? Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, Number(stored)),
          )
        : DEFAULT_RIGHT_WIDTH;
    } catch {
      return DEFAULT_RIGHT_WIDTH;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        "pidesk-left-sidebar-width",
        String(leftSidebarWidth),
      );
    } catch {
      // Ignore storage errors
    }
  }, [leftSidebarWidth]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        "pidesk-right-sidebar-width",
        String(rightSidebarWidth),
      );
    } catch {
      // Ignore storage errors
    }
  }, [rightSidebarWidth]);

  const [isResizingLeft, setIsResizingLeft] = React.useState(false);
  const [isResizingRight, setIsResizingRight] = React.useState(false);

  React.useEffect(() => {
    if (!isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (isResizingLeft) {
        setLeftSidebarWidth(() =>
          Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, event.clientX),
          ),
        );
      }
      if (isResizingRight) {
        const windowWidth = window.innerWidth;
        setRightSidebarWidth(() =>
          Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, windowWidth - event.clientX),
          ),
        );
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight]);

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

  const handleSelectWorktree = React.useCallback(
    async (worktreeId: string) => {
      await window.pidesk.worktrees.select(worktreeId);
      setIsTerminalActive(false);
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
    if (!activeRepositoryId || !newWorktreeBranch.trim()) {
      return;
    }

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

  const handleCreateThread = React.useCallback(async () => {
    if (!activeWorktreeId) {
      return;
    }

    await window.pidesk.threads.create(activeWorktreeId);
    await reload();
  }, [activeWorktreeId, reload]);

  const handleSelectThread = React.useCallback(
    async (threadId: string) => {
      await window.pidesk.threads.select(threadId);
      setIsTerminalActive(false);
      await reload();
    },
    [reload],
  );

  const handleSend = React.useCallback(() => {
    if (!canSend) {
      return;
    }

    sendPrompt();
  }, [canSend, sendPrompt]);

  return (
    <SettingsProvider>
      <TooltipProvider>
      <div
        data-testid="app-ready"
        className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground"
      >
        <TitleBar />

        <div className="relative flex min-h-0 flex-1">
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:100px_100px]" />
          </div>

          <aside
            style={{ width: leftSidebarWidth }}
            className="relative z-10 flex shrink-0 flex-col border-r border-border bg-surface-1"
          >
            <div className="px-4 pt-4" data-no-drag="true">
              <RepositorySwitcher
                repositories={repositories}
                activeRepositoryId={activeRepositoryId}
                onSelect={handleSelectRepository}
                onAdd={handleAddRepository}
              />
            </div>

            <ScrollArea className="min-h-0 flex-1" data-no-drag="true">
              <div className="space-y-4 py-3">
                <WorktreeList
                  worktrees={worktrees}
                  activeWorktreeId={activeWorktreeId}
                  onSelect={handleSelectWorktree}
                  onCreate={handleCreateWorktree}
                />
                <ThreadList
                  threads={threads}
                  activeThreadId={activeThreadId}
                  onSelect={handleSelectThread}
                  onCreate={handleCreateThread}
                />
                <section className="space-y-2 px-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Files
                  </p>
                  <div className="rounded-lg border border-border bg-surface-1">
                    <FileTree
                      rootPath={activeWorktreePath}
                      onFileClick={handleFileClick}
                    />
                  </div>
                </section>
              </div>
            </ScrollArea>

            <div
              className="mt-auto border-t border-border px-4 py-4"
              data-no-drag="true"
            >
              <div className="flex items-end justify-between gap-3">
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
                        onChange={(event) => setNewWorktreeBranch(event.target.value)}
                        placeholder="feature/my-task"
                        className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-hover"
                      />
                      {worktreeCreateError && (
                        <p className="text-sm text-destructive">{worktreeCreateError}</p>
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

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSettingsOpen(true)}
                  className="size-9 rounded border border-border bg-surface-2 text-foreground hover:bg-surface-3 hover:text-foreground"
                  aria-label="Open settings"
                >
                  <Settings2 className="size-4" />
                </Button>
                <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    v{shell.appVersion || "0.1.0"}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/70">
                    Desktop shell
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="relative z-10 flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {activeRepository ? (
                    <>
                      <span data-testid="current-repository-name">
                        {activeRepository.name}
                      </span>
                      <span className="px-1 text-muted-foreground">/</span>
                      <span data-testid="current-worktree-label">
                        {activeWorktree?.label ?? "No worktree"}
                      </span>
                      <span className="px-1 text-muted-foreground">/</span>
                      <span data-testid="current-thread-title">
                        {activeThread?.title ?? "No thread"}
                      </span>
                    </>
                  ) : (
                    "No repository selected"
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {activeWorktree?.git.branch ??
                    activeWorktree?.path ??
                    "Add a repository to begin"}
                </div>
              </div>
              <div className="ml-4 flex items-center gap-2">
                {activeWorktree && <GitStatusChip git={activeWorktree.git} />}
                <RuntimeStatusChip
                  status={activeThread?.runtime.status ?? agent.status}
                  testId="agent-status"
                />
              </div>
            </header>
            {openFiles.length > 0 || isTerminalOpen ? (
              <MultiFileViewer
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                onTabClick={handleTabClick}
                onTabClose={handleTabClose}
                onCloseAll={handleCloseAllFiles}
                onTextSelect={handleTextSelect}
                className="min-h-0 flex-1"
                isTerminalOpen={isTerminalOpen}
                isTerminalActive={isTerminalActive}
                onTerminalClick={() => setIsTerminalActive(true)}
                onTerminalClose={() => { setIsTerminalOpen(false); setIsTerminalActive(false); }}
                terminalCwd={activeWorktreePath ?? undefined}
                terminalId={terminalId}
              />
            ) : (
              <ChatContainerRoot className="relative min-h-0 flex-1">
                <ChatContainerContent
                  data-testid="chat-transcript"
                  className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-40 pt-10"
                >
                  {agent.messages.length === 0 ? (
                    <section className="flex flex-1 flex-col items-center justify-center">
                      <div className="mb-8 text-5xl font-semibold tracking-tight text-muted-foreground/30">
                        π
                      </div>
                    </section>
                  ) : (
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

            <div className="relative z-20 border-t border-border bg-gradient-to-t from-background to-transparent pb-6 pt-4">
              <div className="mx-auto max-w-4xl px-6">
                <PromptInput
                  value={draft}
                  onValueChange={setDraft}
                  onSubmit={handleSend}
                  className="rounded-xl border border-border bg-surface-2 p-4 shadow-lg transition focus-within:border-border-hover focus-within:bg-surface-3 focus-within:shadow-xl"
                >
                  <PromptInputTextarea
                    data-testid="chat-input"
                    placeholder="Ask Pi..."
                    className="min-h-24 resize-none border-0 bg-transparent text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                  />
                  <PromptInputActions className="mt-3 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ReadOnlySelector
                        label="runtime managed"
                        description="The Electron app uses the Pi coding agent's configured model. Direct model switching is not exposed yet."
                      />
                      <ReadOnlySelector
                        label={runtimeModeLabel}
                        description="Agent mode is configured by the desktop runtime and currently reflects the active Pi agent host session."
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[0.7rem] text-zinc-500">
                        Enter to send
                      </span>
                      <PromptInputAction tooltip="Send message">
                        <Button
                          data-testid="chat-send"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg border border-white/8 bg-white/[0.06] text-zinc-200 hover:bg-white/[0.10] disabled:opacity-50"
                          disabled={!canSend}
                          onClick={handleSend}
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

          <aside
            style={{ width: rightSidebarWidth }}
            className="relative z-10 flex shrink-0 flex-col border-l border-border bg-surface-1"
          >
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-surface-2">
              <button
                type="button"
                onClick={() => setActiveView("git")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  activeView === "git"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                )}
              >
                <GitBranch className="size-4" />
              </button>
              <Separator
                orientation="vertical"
                className="mx-2 h-4 bg-border"
              />
              <button
                type="button"
                onClick={() => setActiveView("worktrees")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  activeView === "worktrees"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                )}
              >
                <FolderTree className="size-4" />
              </button>
              <Separator
                orientation="vertical"
                className="mx-2 h-4 bg-border"
              />
              <button
                type="button"
                onClick={() => setActiveView("context")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  activeView === "context"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                )}
              >
                <FolderGit className="size-4" />
              </button>
              <Separator
                orientation="vertical"
                className="mx-2 h-4 bg-border"
              />
              <button
                type="button"
                onClick={() => setActiveView("history")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  activeView === "history"
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                )}
              >
                <History className="size-4" />
              </button>
              <Separator
                orientation="vertical"
                className="mx-2 h-4 bg-border"
              />
              <button
                type="button"
                onClick={() => { setIsTerminalOpen(true); setIsTerminalActive(true); }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  isTerminalOpen
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
                )}
              >
                <TerminalIcon className="size-4" />
              </button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-3">
                {activeView === "git" && <GitInspector git={shell.git} />}

                {activeView === "worktrees" && (
                  <WorktreeInspector
                    repositories={repositories}
                    activeRepositoryId={activeRepositoryId}
                    activeWorktreeId={activeWorktreeId}
                  />
                )}

                {activeView === "context" && (
                  <ContextInspector
                    lastError={agent.lastError}
                    runtimeMode={runtimeMode}
                    repositoryName={activeRepository?.name ?? null}
                    worktreePath={activeWorktreePath}
                    threadTitle={activeThread?.title ?? null}
                    supportsTurns={shell.capabilities?.supportsTurns}
                    supportsTools={shell.capabilities?.supportsTools}
                    supportsActivity={shell.capabilities?.supportsActivity}
                    supportsParallelSessions={
                      shell.capabilities?.supportsParallelSessions
                    }
                  />
                )}

                {activeView === "history" && (
                  <HistoryInspector items={activityItems} />
                )}

                {todoItems.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Tasks
                    </p>
                    <Todo items={todoItems} />
                  </section>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border px-3 py-2 bg-surface-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>v{shell.appVersion || "0.1.0"}</span>
                <span className="uppercase">{runtimeMode}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </TooltipProvider>
    </SettingsProvider>
  );
}
