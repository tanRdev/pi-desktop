"use client";
import type { AgentMessageSnapshot, ShellGitSnapshot, ShellProjectSnapshot } from "@pidesk/shared";

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
  ChevronRight,
  FolderGit,
  FolderTree,
  GitBranch,
  History,
  Plus,
  Settings2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./components/ui/button";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "./components/ui/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { ProjectList } from "./components/project-list";
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

const PROMPT_SUGGESTIONS = [
  "Summarize this workspace and tell me what matters most.",
  "Inspect the current repository state and explain the next safest move.",
  "Outline the active agent capabilities in this desktop shell.",
];

type InspectorView = "git" | "files" | "context" | "history";

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

function getStatusClass(status: string) {
  switch (status) {
    case "streaming":
      return "border-amber-700/40 bg-amber-700/15 text-amber-300";
    case "error":
      return "border-red-700/40 bg-red-700/15 text-red-300";
    case "starting":
      return "border-stone-600/30 bg-stone-600/10 text-stone-400";
    default:
      return "border-lime-700/30 bg-lime-700/10 text-lime-400";
  }
}

function getStatusDotClass(status: string) {
  switch (status) {
    case "streaming":
      return "bg-amber-500 animate-pulse";
    case "error":
      return "bg-red-500";
    case "starting":
      return "bg-stone-500 animate-pulse";
    default:
      return "bg-lime-500";
  }
}

function getPathTail(value?: string | null) {
  if (!value) {
    return "Unavailable";
  }

  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

function getActiveProject(
  projects:
    | {
        id: string;
        isActive: boolean;
        name: string;
        path: string;
      }[]
    | undefined,
) {
  return projects?.find((project) => project.isActive) ?? projects?.[0] ?? null;
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
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
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
            <span className="truncate text-foreground/80">{git.commit ?? "—"}</span>
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
          <p className="text-xs uppercase tracking-wide text-foreground/50">Root</p>
          <p className="mt-1 break-words text-foreground/80">
            {rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-foreground/50">Project</p>
          <p className="mt-1 break-words text-foreground/80">
            {projectPath ?? rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-foreground/50">Agent dir</p>
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
          <span className="text-foreground/80">{supportsTurns ? "on" : "off"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Tools</span>
          <span className="text-foreground/80">{supportsTools ? "on" : "off"}</span>
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
      className="titlebar h-10 shrink-0 border-b border-border bg-surface-1"
    />
  );
}

export default function App() {
  const { reset, sendPrompt, setDraft, state } = useShellModel();
  const { agent, draft, live, shell } = state;

  const [activeView, setActiveView] = React.useState<InspectorView>("git");
  const [interfaceFont, setInterfaceFont] = React.useState(() =>
    readStoredValue("pidesk-font-sans", UI_FONT_OPTIONS[0]!.value),
  );
  const [codeFont, setCodeFont] = React.useState(() =>
    readStoredValue("pidesk-font-mono", CODE_FONT_OPTIONS[0]!.value),
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
  const appTitle = shell.appName || "PiDesk";
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
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(() => {
    try {
      return window.localStorage.getItem("pidesk-active-project");
    } catch {
      return null;
    }
  });

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
  // Sidebar width state with localStorage persistence
  const MIN_SIDEBAR_WIDTH = 180;
  const MAX_SIDEBAR_WIDTH = 400;
  const DEFAULT_LEFT_WIDTH = 240;
  const DEFAULT_RIGHT_WIDTH = 250;

  const [leftSidebarWidth, setLeftSidebarWidth] = React.useState(() => {
    try {
      const stored = window.localStorage.getItem("pidesk-left-sidebar-width");
      return stored ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Number(stored))) : DEFAULT_LEFT_WIDTH;
    } catch {
      return DEFAULT_LEFT_WIDTH;
    }
  });
  const [rightSidebarWidth, setRightSidebarWidth] = React.useState(() => {
    try {
      const stored = window.localStorage.getItem("pidesk-right-sidebar-width");
      return stored ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Number(stored))) : DEFAULT_RIGHT_WIDTH;
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
      window.localStorage.setItem("pidesk-left-sidebar-width", String(leftSidebarWidth));
    } catch {
      // Ignore storage errors
    }
  }, [leftSidebarWidth]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem("pidesk-right-sidebar-width", String(rightSidebarWidth));
    } catch {
      // Ignore storage errors
    }
  }, [rightSidebarWidth]);

  // Handle resize drag
  React.useEffect(() => {
    if (!isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        setLeftSidebarWidth((prev) =>
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX))
        );
      }
      if (isResizingRight) {
        const windowWidth = window.innerWidth;
        setRightSidebarWidth((prev) =>
          Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, windowWidth - e.clientX))
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
    try {
      const paths = await window.pidesk.dialog.showOpenDialog({
        properties: ["openDirectory", "multiSelections"],
        title: "Add Project Folder",
      });
      if (!paths || paths.length === 0) return;

      const newProjects: ShellProjectSnapshot[] = paths.map((path) => ({
        id: `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
        path,
        isActive: false,
      }));

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
  }, [activeProjectId]);

  // Handle removing a project
  const handleRemoveProject = React.useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  }, [activeProjectId]);

  // Handle selecting a project
  const handleSelectProject = React.useCallback((id: string) => {
    setActiveProjectId(id);
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        isActive: p.id === id,
      })),
    );
  }, []);

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

  const handleSend = React.useCallback(() => {
    if (!canSend) {
      return;
    }

    sendPrompt();
  }, [canSend, sendPrompt]);

  const handleNewThread = React.useCallback(() => {
    void reset();
  }, [reset]);

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
            className="relative z-10 flex shrink-0 flex-col border-r border-border bg-surface-1">
            <div className="px-4 pt-4" data-no-drag="true">
              <Button
                onClick={handleNewThread}
                className="h-10 w-full justify-between rounded border border-border bg-surface-2 px-3 text-sm font-medium text-foreground shadow-sm transition hover:border-border-hover hover:bg-surface-3"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Plus className="size-4" />
                  New Thread
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-4 py-4">
                <ProjectList
                  projects={projects}
                  activeProjectId={activeProjectId}
                  onAddProject={handleAddProject}
                  onRemoveProject={handleRemoveProject}
                  onSelectProject={handleSelectProject}
                />

              </div>
            </ScrollArea>

            <div
              className="mt-auto border-t border-border px-4 py-4"
              data-no-drag="true"
            >
              <div className="flex items-end justify-between gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded border border-border bg-surface-2 text-foreground hover:bg-surface-3 hover:text-foreground"
                      aria-label="Open settings"
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    className="w-56 rounded border border-border bg-popover p-4 text-popover-foreground shadow-lg"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Settings
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Refine the interface typography.
                        </p>
                      </div>

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
                  </PopoverContent>
                </Popover>

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
            <header
              data-drag-region="true"
              className="relative flex h-16 shrink-0 items-center justify-between border-b border-border px-6 bg-surface-1"
            >
              <div className="min-w-0 w-32" />

              <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                <div
                  aria-hidden="true"
                  className="pt-4 text-2xl font-semibold tracking-tight text-muted-foreground"
                >
                  π
                </div>
              </div>

              <div className="flex items-center gap-2" data-no-drag="true">
                <div
                  data-testid="agent-status"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em]",
                    getStatusClass(agent.status),
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      getStatusDotClass(agent.status),
                    )}
                  />
                  {agent.status}
                </div>
              </div>
            </header>

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
                  <>
                    {agent.messages.map((message) => {
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
                    })}
                  </>
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

            <div className="relative z-20 border-t border-border bg-gradient-to-t from-background to-transparent pb-6 pt-4">
              <div className="mx-auto max-w-4xl px-6">
                {agent.messages.length === 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDraft(suggestion)}
                        className="rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-muted-foreground transition hover:border-border-hover hover:bg-surface-3 hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <PromptInput
                  value={draft}
                  onValueChange={setDraft}
                  onSubmit={handleSend}
                  className="rounded-xl border border-border bg-surface-2 p-4 shadow-lg transition focus-within:border-border-hover focus-within:bg-surface-3 focus-within:shadow-xl"
                >
                  <PromptInputTextarea
                    data-testid="chat-input"
                    placeholder="Ask PiDesk to read the room..."
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
            className="relative z-10 flex shrink-0 flex-col border-l border-border bg-surface-1">
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
