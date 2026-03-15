"use client";

import type { AgentMessageSnapshot, ShellGitSnapshot } from "@pidesk/shared";
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

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) {
    return "Just now";
  }

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${days}d ago`;
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
      return "border-amber-400/30 bg-amber-400/12 text-amber-200";
    case "error":
      return "border-rose-400/30 bg-rose-400/12 text-rose-200";
    case "starting":
      return "border-white/10 bg-white/[0.05] text-zinc-300";
    default:
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
  }
}

function getStatusDotClass(status: string) {
  switch (status) {
    case "streaming":
      return "bg-amber-300 animate-pulse";
    case "error":
      return "bg-rose-300";
    case "starting":
      return "bg-zinc-400 animate-pulse";
    default:
      return "bg-emerald-400";
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

function getThreadTitle(messages: AgentMessageSnapshot[]) {
  const firstUserMessage = messages.find(
    (message) => message.role === "user" && message.text.trim().length > 0,
  );

  if (!firstUserMessage) {
    return "New conversation";
  }

  const title =
    firstUserMessage.text.trim().split("\n")[0] ?? "New conversation";
  return title.length > 40 ? `${title.slice(0, 40)}...` : title;
}

function getLatestMessageTimestamp(messages: AgentMessageSnapshot[]) {
  return messages[messages.length - 1]?.timestamp;
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
      <span className="text-[0.6rem] uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-xs text-zinc-200 outline-none transition hover:border-white/20"
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
          className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
        >
          {label}
          <ChevronDown className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 rounded-lg border border-white/[0.08] bg-[hsl(222,24%,8%)] p-3"
      >
        <p className="text-[0.6rem] uppercase tracking-[0.18em] text-zinc-500">
          Read only
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-300">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

function GitInspector({ git }: { git?: ShellGitSnapshot }) {
  if (!git || git.status === "not_repo") {
    return (
      <section className="space-y-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">
              No repository
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            This workspace is not inside a git repository.
          </p>
        </div>
      </section>
    );
  }

  if (git.status === "unavailable") {
    return (
      <section className="space-y-2">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="size-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">
              Git unavailable
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            {git.message ?? "The desktop shell could not inspect git state."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-300">
            {getPathTail(git.rootPath)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          {git.branch ?? "detached"} • {git.hasChanges ? "changed" : "clean"}
        </p>
        <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
          <div className="flex justify-between gap-2">
            <span>Commit</span>
            <span className="truncate text-zinc-300">{git.commit ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Changes</span>
            <span className="text-zinc-300">
              {git.stagedCount ?? 0}/{git.modifiedCount ?? 0}/
              {git.untrackedCount ?? 0}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Sync</span>
            <span className="text-zinc-300">
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
      <p className="text-[11px] font-medium text-zinc-500">Files</p>
      <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400">
        <div>
          <p className="uppercase tracking-[0.16em] text-zinc-600">Root</p>
          <p className="mt-1 break-words text-zinc-300">
            {rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.16em] text-zinc-600">Project</p>
          <p className="mt-1 break-words text-zinc-300">
            {projectPath ?? rootPath ?? "Unavailable"}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-[0.16em] text-zinc-600">Agent dir</p>
          <p className="mt-1 break-words text-zinc-300">
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
      <p className="text-[11px] font-medium text-zinc-500">Context</p>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400">
        <div className="flex justify-between gap-2">
          <span>Agent mode</span>
          <span className="capitalize text-zinc-300">
            {runtimeMode ?? "unknown"}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-2">
          <span>Turns</span>
          <span className="text-zinc-300">{supportsTurns ? "on" : "off"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Tools</span>
          <span className="text-zinc-300">{supportsTools ? "on" : "off"}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Activity</span>
          <span className="text-zinc-300">
            {supportsActivity ? "on" : "off"}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span>Parallel</span>
          <span className="text-zinc-300">
            {supportsParallelSessions ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-5 text-zinc-400">
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
      <p className="text-[11px] font-medium text-zinc-500">History</p>
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded px-2 py-1 text-xs text-zinc-400"
            >
              <div>{formatActivityType(item.type)}</div>
              <div className="text-[10px] text-zinc-600">
                {formatTimestamp(item.timestamp)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-400">
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
      className="titlebar h-10 shrink-0 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl"
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

  const activeProject = React.useMemo(
    () => getActiveProject(shell.workspace?.projects),
    [shell.workspace?.projects],
  );
  const activityItems = React.useMemo(
    () => [...live.activity].slice(-6).reverse(),
    [live.activity],
  );
  const threadTitle = React.useMemo(
    () => getThreadTitle(agent.messages),
    [agent.messages],
  );
  const latestMessageTimestamp = React.useMemo(
    () => getLatestMessageTimestamp(agent.messages),
    [agent.messages],
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
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:100px_100px]" />
          </div>

          <aside className="relative z-10 flex w-[15rem] shrink-0 flex-col border-r border-white/8 bg-black/15 backdrop-blur-2xl">
            <div className="px-4 pt-4" data-no-drag="true">
              <Button
                onClick={handleNewThread}
                className="h-10 w-full justify-between rounded-md border border-white/10 bg-white/[0.06] px-3 text-[0.75rem] font-medium text-zinc-100 shadow-sm transition hover:border-white/15 hover:bg-white/[0.10]"
              >
                <span className="inline-flex items-center gap-2.5">
                  <Plus className="size-4" />
                  New Thread
                </span>
                <ChevronRight className="size-4 text-zinc-500" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-4 py-4">
                <section className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                      Workspace
                    </p>
                    <h1
                      data-testid="app-title"
                      className="text-sm font-medium tracking-[-0.01em] text-zinc-100"
                    >
                      {appTitle}
                    </h1>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Project</span>
                      <span className="truncate text-zinc-300">
                        {activeProject?.name ?? "Unavailable"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Mode</span>
                      <span className="capitalize text-zinc-300">
                        {runtimeMode}
                      </span>
                    </div>
                  </div>

                  <p className="truncate text-[11px] leading-4 text-zinc-500">
                    {shell.workspace?.rootPath ??
                      "Workspace metadata unavailable"}
                  </p>
                </section>

                <section className="space-y-1.5">
                  <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                    Session
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Messages
                      </span>
                      <span className="text-[11px] text-zinc-300">
                        {agent.messages.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Turns
                      </span>
                      <span className="text-[11px] text-zinc-300">
                        {live.turns.length}
                      </span>
                    </div>
                    <p className="pt-0.5 text-[11px] text-zinc-500">
                      {runtimeModeLabel}
                    </p>
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                    Threads
                  </p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition",
                        "border-white/20 bg-white/[0.08]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] text-zinc-100">
                          {threadTitle}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {formatRelativeTime(latestMessageTimestamp)}
                        </span>
                      </div>
                    </button>
                  </div>
                </section>
              </div>
            </ScrollArea>

            <div
              className="mt-auto border-t border-white/8 px-4 py-4"
              data-no-drag="true"
            >
              <div className="flex items-end justify-between gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]"
                      aria-label="Open settings"
                    >
                      <Settings2 className="size-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="top"
                    className="w-[14rem] rounded-xl border-white/10 bg-[rgba(18,18,22,0.96)] p-3 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
                  >
                    <div className="space-y-3">
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                          Settings
                        </p>
                        <p className="mt-1.5 text-xs text-zinc-300">
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
                  <p className="text-[0.6rem] uppercase tracking-[0.3em] text-zinc-600">
                    v{shell.appVersion || "0.1.0"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                    Desktop shell
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="relative z-10 flex min-w-0 flex-1 flex-col">
            <header
              data-drag-region="true"
              className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-6 backdrop-blur-xl"
            >
              <div className="min-w-0 w-32" />

              <div className="pointer-events-none absolute inset-x-0 flex justify-center">
                <div
                  aria-hidden="true"
                  className="pt-4 text-[1.35rem] font-semibold tracking-[-0.08em] text-zinc-600"
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
                    <div className="mb-8 text-5xl font-semibold tracking-[-0.08em] text-zinc-600">
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
                              <span className="text-xs font-medium text-zinc-400">
                                {getMessageLabel(message)}
                              </span>
                            )}

                            {isSystem ? (
                              <div className="mt-1 rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-800/30 px-4 py-3 text-sm text-zinc-400">
                                {message.text}
                              </div>
                            ) : (
                              <MessageContent
                                markdown={message.role !== "user"}
                                className="mt-1 max-w-none bg-transparent p-0 text-sm leading-6 text-zinc-100 shadow-none"
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

            <div className="relative z-20 border-t border-white/6 bg-gradient-to-t from-background to-transparent pb-6 pt-4">
              <div className="mx-auto max-w-4xl px-6">
                {agent.messages.length === 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDraft(suggestion)}
                        className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-zinc-200"
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
                  className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition focus-within:border-white/14 focus-within:bg-white/[0.06] focus-within:shadow-[0_12px_48px_rgba(0,0,0,0.35)]"
                >
                  <PromptInputTextarea
                    data-testid="chat-input"
                    placeholder="Ask PiDesk to read the room..."
                    className="min-h-[4.5rem] resize-none border-0 bg-transparent text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
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

          <aside className="relative z-10 flex w-48 shrink-0 flex-col border-l border-white/[0.06] bg-black/20">
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-2">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveView("git")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    activeView === "git"
                      ? "bg-white/[0.08] text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200",
                  )}
                >
                  <GitBranch className="size-4" />
                </button>
                <Separator
                  orientation="vertical"
                  className="mx-1 h-4 bg-white/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setActiveView("files")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    activeView === "files"
                      ? "bg-white/[0.08] text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200",
                  )}
                >
                  <FolderTree className="size-4" />
                </button>
                <Separator
                  orientation="vertical"
                  className="mx-1 h-4 bg-white/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setActiveView("context")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    activeView === "context"
                      ? "bg-white/[0.08] text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200",
                  )}
                >
                  <FolderGit className="size-4" />
                </button>
                <Separator
                  orientation="vertical"
                  className="mx-1 h-4 bg-white/[0.08]"
                />
                <button
                  type="button"
                  onClick={() => setActiveView("history")}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition",
                    activeView === "history"
                      ? "bg-white/[0.08] text-zinc-200"
                      : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200",
                  )}
                >
                  <History className="size-4" />
                </button>
              </div>
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

            <div className="border-t border-white/[0.06] px-3 py-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
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
