"use client";
import type {
  AgentMessageSnapshot,
  FileContent,
  ShellGitSnapshot,
  ShellProjectSnapshot,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Terminal } from "./components/ui/terminal";
import { useShellModel } from "./hooks/use-shell-model";

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

type InspectorView = "git" | "files" | "context" | "history";

type SidebarView = "files" | "threads";

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

function FilesInspector({
  agentDirectory,
  projectPath,
  rootPath,
}: {
  agentDirectory?: string | null;
  projectPath?: string;
  rootPath?: string;
}) {
  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Files</p>
      <div className="space-y-3 rounded border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
        <div>
          <p className="text-xs uppercase tracking-wide text-foreground/50">
            Root
          </p>
          <p className="mt-1 break-words text-foreground/80">
            {rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-foreground/50">
            Project
          </p>
          <p className="mt-1 break-words text-foreground/80">
            {projectPath ?? rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-foreground/50">
            Agent dir
          </p>
          <p className="mt-1 break-words text-foreground/80">
            {agentDirectory ?? "Unavailable"}
          </p>
        </div>
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
}: {
  lastError: string | null;
  runtimeMode?: string;
  supportsActivity?: boolean;
  supportsParallelSessions?: boolean;
  supportsTools?: boolean;
  supportsTurns?: boolean;
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
  const { sendPrompt, setDraft, state } = useShellModel();
  const { agent, draft, live, shell } = state;

  const [activeView, setActiveView] = React.useState<InspectorView>("git");
  const [sidebarView, setSidebarView] = React.useState<SidebarView>(() => {
    try {
      return (
        (window.localStorage.getItem("pidesk-sidebar-view") as SidebarView) ??
        "files"
      );
    } catch {
      return "files";
    }
  });
  const [interfaceFont, setInterfaceFont] = React.useState(() =>
    readStoredValue("pidesk-font-sans", UI_FONT_OPTIONS[0]?.value ?? "Inter"),
  );
  const [codeFont, setCodeFont] = React.useState(() =>
    readStoredValue(
      "pidesk-font-mono",
      CODE_FONT_OPTIONS[0]?.value ?? "JetBrains Mono",
    ),
  );

  const activityItems = React.useMemo(
    () => [...live.activity].slice(-6).reverse(),
    [live.activity],
  );
  const todoItems = React.useMemo(
    () =>
      buildTodoItems({
        activityCount: live.activity.length,
        gitStatus: shell.git?.status,
        hasAssistantReply: agent.messages.some(
          (message) => message.role === "assistant",
        ),
        hasWorkspace: Boolean(shell.workspace?.rootPath),
        status: agent.status,
      }),
    [
      agent.messages,
      agent.status,
      live.activity.length,
      shell.git?.status,
      shell.workspace?.rootPath,
    ],
  );

  const canSend =
    draft.trim().length > 0 &&
    agent.status !== "starting" &&
    agent.status !== "streaming";
  const runtimeMode = shell.runtime?.agentMode ?? "unknown";
  const runtimeModeLabel = `${runtimeMode} mode`;
  // Project management state with localStorage persistence
  const [projects, setProjects] = React.useState<ShellProjectSnapshot[]>(() => {
    try {
      const stored = window.localStorage.getItem("pidesk-projects");
      if (stored) {
        return JSON.parse(stored) as ShellProjectSnapshot[];
      }
    } catch {
      // Ignore parse errors
    }
    // Default: use current workspace project if available
    return shell.workspace?.projects ?? [];
  });
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(
    () => {
      try {
        return window.localStorage.getItem("pidesk-active-project");
      } catch {
        return null;
      }
    },
  );
  // Multi-file viewer state
  const [openFiles, setOpenFiles] = React.useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = React.useState<string | null>(
    null,
  );
  const [isTerminalOpen, setIsTerminalOpen] = React.useState(false);
  const [isTerminalActive, setIsTerminalActive] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [terminalId] = React.useState(() => `terminal-${Date.now()}`);

  // Load file content when a file is opened
  const loadFile = React.useCallback(
    async (filePath: string) => {
      // Check if file is already open
      const existingFile = openFiles.find((f) => f.path === filePath);
      if (existingFile) {
        setActiveFilePath(filePath);
        setIsTerminalActive(false);
        return;
      }

      // Add file to open files with loading state
      setOpenFiles((prev) => [
        ...prev,
        { path: filePath, content: null, isLoading: true, error: null },
      ]);
      setActiveFilePath(filePath);
      setIsTerminalActive(false);

      // Load file content
      try {
        const result = await window.pidesk.fs.readFile(filePath);
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === filePath
              ? { ...f, content: result, isLoading: false }
              : f,
          ),
        );
      } catch (err) {
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === filePath
              ? {
                  ...f,
                  error:
                    err instanceof Error ? err.message : "Failed to load file",
                  isLoading: false,
                }
              : f,
          ),
        );
      }
    },
    [openFiles],
  );

  // Handle file click from file tree
  const handleFileClick = React.useCallback(
    (filePath: string) => {
      void loadFile(filePath);
    },
    [loadFile],
  );

  // Handle tab click
  const handleTabClick = React.useCallback((filePath: string) => {
    setActiveFilePath(filePath);
    setIsTerminalActive(false);
  }, []);

  // Handle tab close
  const handleTabClose = React.useCallback(
    (filePath: string) => {
      setOpenFiles((prev) => {
        const newFiles = prev.filter((f) => f.path !== filePath);
        // If closing the active file, switch to another file
        if (activeFilePath === filePath && newFiles.length > 0) {
          const index = prev.findIndex((f) => f.path === filePath);
          const nextFile = newFiles[Math.max(0, index - 1)];
          setActiveFilePath(nextFile?.path ?? null);
        } else if (newFiles.length === 0) {
          setActiveFilePath(null);
        }
        return newFiles;
      });
    },
    [activeFilePath],
  );

  // Handle close all files
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

  const [isWorkspacePopoverOpen, setIsWorkspacePopoverOpen] =
    React.useState(false);
  // Persist projects to localStorage
  React.useEffect(() => {
    try {
      window.localStorage.setItem("pidesk-projects", JSON.stringify(projects));
    } catch {
      // Ignore storage errors
    }
  }, [projects]);

  // Persist active project
  React.useEffect(() => {
    try {
      if (activeProjectId) {
        window.localStorage.setItem("pidesk-active-project", activeProjectId);
      } else {
        window.localStorage.removeItem("pidesk-active-project");
      }
    } catch {
      // Ignore storage errors
    }
  }, [activeProjectId]);

  // Persist sidebar view preference
  React.useEffect(() => {
    try {
      window.localStorage.setItem("pidesk-sidebar-view", sidebarView);
    } catch {
      // Ignore storage errors
    }
  }, [sidebarView]);
  // Sidebar width state with localStorage persistence
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 400;
  const DEFAULT_LEFT_WIDTH = 240;
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

  // Resize drag state
  const [isResizingLeft, setIsResizingLeft] = React.useState(false);
  const [isResizingRight, setIsResizingRight] = React.useState(false);

  // Persist sidebar widths
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

  // Handle resize drag
  React.useEffect(() => {
    if (!isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        setLeftSidebarWidth(() =>
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX)),
        );
      }
      if (isResizingRight) {
        const windowWidth = window.innerWidth;
        setRightSidebarWidth(() =>
          Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, windowWidth - e.clientX),
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
  // Handle adding a project via file picker
  const handleAddProject = React.useCallback(async () => {
    setIsWorkspacePopoverOpen(false);
    console.log("handleAddProject called, window.pidesk:", window.pidesk);
    if (!window.pidesk) {
      console.error("window.pidesk is not defined!");
      alert("API not available - check console");
      return;
    }
    if (!window.pidesk.dialog) {
      console.error("window.pidesk.dialog is not defined!");
      alert("Dialog API not available - check console");
      return;
    }
    try {
      console.log("Calling showOpenDialog...");
      const paths = await window.pidesk.dialog.showOpenDialog({
        properties: ["openDirectory", "multiSelections"],
        title: "Add Project Folder",
      });
      console.log("showOpenDialog returned:", paths);
      if (!paths || paths.length === 0) return;

      // Normalize paths for comparison (resolve to absolute, remove trailing slashes)
      const normalizePath = (p: string) => p.replace(/[\\/]+$/, "");
      const existingPaths = new Set(projects.map((p) => normalizePath(p.path)));

      // Filter out duplicates and paths already in the workspace
      const uniqueNewPaths = paths.filter(
        (path) => !existingPaths.has(normalizePath(path)),
      );

      if (uniqueNewPaths.length === 0) {
        console.log("All selected directories are already in the workspace");
        return;
      }

      if (uniqueNewPaths.length < paths.length) {
        console.log(
          `Skipped ${paths.length - uniqueNewPaths.length} duplicate director` +
            "ies",
        );
      }

      const newProjects: ShellProjectSnapshot[] = uniqueNewPaths.map(
        (path) => ({
          id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
          path,
          isActive: false,
        }),
      );

      setProjects((prev) => [...prev, ...newProjects]);
      if (!activeProjectId) {
        const firstProject = newProjects[0];
        if (firstProject) {
          setActiveProjectId(firstProject.id);
        }
      }
    } catch (error) {
      console.error("Failed to add project:", error);
    }
  }, [activeProjectId, projects]);

  // Handle removing a project
  const handleRemoveProject = React.useCallback(
    (id: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(null);
      }
    },
    [activeProjectId],
  );

  // Handle selecting a project
  const handleSelectProject = React.useCallback(
    async (id: string) => {
      setIsWorkspacePopoverOpen(false);
      setActiveProjectId(id);
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          isActive: p.id === id,
        })),
      );

      const project = projects.find((p) => p.id === id);
      if (project) {
        try {
          await window.pidesk.agent.switchWorkspace(project.path);
        } catch (error) {
          console.error("Failed to switch workspace:", error);
        }
      }
    },
    [projects],
  );

  // Computed active project from state
  const activeProject = React.useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId],
  );
  React.useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-sans",
      interfaceFont,
    );
    document.documentElement.style.setProperty("--app-font-mono", codeFont);
    window.localStorage.setItem("pidesk-font-sans", interfaceFont);
    window.localStorage.setItem("pidesk-font-mono", codeFont);
  }, [codeFont, interfaceFont]);

  React.useEffect(() => {
    if (
      activeProject &&
      shell.workspace?.rootPath &&
      activeProject.path !== shell.workspace.rootPath
    ) {
      window.pidesk.agent
        .switchWorkspace(activeProject.path)
        .catch(console.error);
    }
  }, [activeProject, shell.workspace?.rootPath]);

  const handleSend = React.useCallback(() => {
    if (!canSend) {
      return;
    }

    sendPrompt();
  }, [canSend, sendPrompt]);

  return (
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
              <Popover
                open={isWorkspacePopoverOpen}
                onOpenChange={setIsWorkspacePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-10 w-full justify-between rounded border border-border bg-surface-2 px-3 text-sm font-medium text-foreground shadow-sm transition hover:border-border-hover hover:bg-surface-3"
                  >
                    <span className="truncate">
                      {activeProject ? activeProject.path : "Workspace"}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[var(--radix-popover-trigger-width)] rounded border border-border bg-popover p-2 shadow-lg"
                >
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="group flex items-center justify-between rounded px-2 py-1.5 text-sm transition hover:bg-surface-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectProject(project.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Folder className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-foreground">
                            {project.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveProject(project.id)}
                          className="opacity-0 transition hover:text-destructive group-hover:opacity-100"
                          aria-label="Remove project"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {projects.length > 0 && <Separator className="my-1" />}
                    <button
                      type="button"
                      onClick={handleAddProject}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground transition hover:bg-surface-3"
                    >
                      <Plus className="size-4 shrink-0 text-muted-foreground" />
                      Add Directory
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Sidebar view toggle */}
            <div className="px-4 py-2" data-no-drag="true">
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setSidebarView("files")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
                    sidebarView === "files"
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileText className="size-3.5" />
                  <span>FILES</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarView("threads")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition",
                    sidebarView === "threads"
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <MessageSquare className="size-3.5" />
                  <span>THREADS</span>
                </button>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1" data-no-drag="true">
              {sidebarView === "files" ? (
                <FileTree
                  rootPath={activeProject?.path}
                  onFileClick={handleFileClick}
                />
              ) : (
                <div className="space-y-1 p-2">
                  {/* Current thread */}
                  <button
                    type="button"
                    className="w-full rounded-lg border border-border bg-surface-2 p-3 text-left transition hover:bg-surface-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10">
                        <MessageSquare className="size-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {agent.messages.length > 0
                            ? (() => {
                                const firstUserMsg = agent.messages.find(
                                  (m) => m.role === "user",
                                );
                                if (firstUserMsg?.text) {
                                  return (
                                    firstUserMsg.text.slice(0, 50) +
                                    (firstUserMsg.text.length > 50 ? "..." : "")
                                  );
                                }
                                return "New conversation";
                              })()
                            : "New conversation"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {agent.messages.length} message
                          {agent.messages.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </ScrollArea>

            <div
              className="mt-auto border-t border-border px-4 py-4"
              data-no-drag="true"
            >
              <div className="flex items-end justify-between gap-3">
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded border border-border bg-surface-2 text-foreground hover:bg-surface-3 hover:text-foreground"
                      aria-label="Open settings"
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Settings</DialogTitle>
                      <DialogDescription>
                        Customize the interface typography and appearance.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <SettingsSelect
                        label="Interface font"
                        value={interfaceFont}
                        onChange={setInterfaceFont}
                        options={UI_FONT_OPTIONS}
                      />
                      <SettingsSelect
                        label="Code font"
                        value={codeFont}
                        onChange={setCodeFont}
                        options={CODE_FONT_OPTIONS}
                      />
                    </div>
                  </DialogContent>
                </Dialog>

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
                terminalCwd={activeProject?.path}
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
                onClick={() => setActiveView("files")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded transition",
                  activeView === "files"
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

                {activeView === "files" && (
                  <FilesInspector
                    rootPath={shell.workspace?.rootPath}
                    projectPath={activeProject?.path}
                    agentDirectory={shell.workspace?.agentDirectory}
                  />
                )}

                {activeView === "context" && (
                  <ContextInspector
                    lastError={agent.lastError}
                    runtimeMode={runtimeMode}
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
  );
}
