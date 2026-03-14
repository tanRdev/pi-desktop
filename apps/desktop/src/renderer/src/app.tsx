"use client";

import type { AgentMessageSnapshot, ShellGitSnapshot } from "@pidesk/shared";
import {
  AlertTriangle,
  ArrowUp,
  ChevronRight,
  CircleSlash,
  FolderCode,
  GitBranch,
  GitCommitHorizontal,
  GitCompareArrows,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Waypoints,
  Workflow,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtItem,
  ChainOfThoughtStep,
  ChainOfThoughtTrigger,
} from "./components/ui/chain-of-thought";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "./components/ui/chat-container";
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from "./components/ui/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "./components/ui/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "./components/ui/reasoning";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { ThinkingBar } from "./components/ui/thinking-bar";
import { Tool, type ToolPart } from "./components/ui/tool";
import { TooltipProvider } from "./components/ui/tooltip";
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

function formatPlatform(platform: string) {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return platform;
  }
}

function formatAgentStatus(status: string) {
  switch (status) {
    case "streaming":
      return "Reasoning";
    case "ready":
      return "Ready";
    case "starting":
      return "Booting";
    case "error":
      return "Attention";
    default:
      return status;
  }
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

function getActiveProjectName(
  projects:
    | {
        id: string;
        isActive: boolean;
        name: string;
        path: string;
      }[]
    | undefined,
) {
  const activeProject =
    projects?.find((project) => project.isActive) ?? projects?.[0];

  return activeProject ?? null;
}

function getPathTail(value?: string | null) {
  if (!value) {
    return "No workspace";
  }

  const segments = value.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? value;
}

function describeUnknown(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeToolPayload(
  value: unknown,
): Record<string, unknown> | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return { items: value };
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return { value };
}

function toToolPart(tool: {
  args: unknown;
  partialResult: unknown;
  result: unknown;
  status: "complete" | "error" | "running";
  toolCallId: string;
  toolName: string;
}): ToolPart {
  const state =
    tool.status === "running"
      ? "input-streaming"
      : tool.status === "error"
        ? "output-error"
        : "output-available";

  return {
    type: tool.toolName,
    state,
    toolCallId: tool.toolCallId,
    input: normalizeToolPayload(tool.args),
    output: normalizeToolPayload(tool.result ?? tool.partialResult),
    errorText:
      tool.status === "error" ? describeUnknown(tool.result) : undefined,
  };
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

type ReasoningStep = {
  id: string;
  title: string;
  detail: string;
  isActive?: boolean;
};

function buildReasoningSteps(options: {
  activityCount: number;
  git?: ShellGitSnapshot;
  projectName: string;
  status: string;
  toolNames: string[];
}) {
  const { activityCount, git, projectName, status, toolNames } = options;

  return [
    {
      id: "workspace",
      title: "Read workspace envelope",
      detail:
        git?.status === "repository"
          ? `${projectName} is connected to ${git.branch ?? "HEAD"} with ${git.hasChanges ? "working tree changes available for context" : "a clean working tree"}.`
          : `${projectName} is active. When a repository becomes available, this surface will promote git context automatically.`,
      isActive: true,
    },
    {
      id: "tools",
      title:
        toolNames.length > 0
          ? `Coordinate ${toolNames.length} observable tool${toolNames.length === 1 ? "" : "s"}`
          : "Prepare observable tool calls",
      detail:
        toolNames.length > 0
          ? `Current tool stream: ${toolNames.join(", ")}. This panel is ready to evolve from milestones into richer streaming reasoning views.`
          : "Prompt-kit components are installed and ready to surface live tool milestones without exposing hidden chain-of-thought.",
      isActive: status === "streaming" || toolNames.length > 0,
    },
    {
      id: "response",
      title:
        status === "streaming"
          ? "Assemble the response"
          : "Stand by for the next turn",
      detail:
        status === "streaming"
          ? `Visible milestones are updating from ${activityCount} recent activity event${activityCount === 1 ? "" : "s"}.`
          : "When streaming starts, this scaffold can expand into a richer step-by-step reasoning surface backed by real-time events.",
      isActive: status === "streaming",
    },
  ] satisfies ReasoningStep[];
}

export default function App() {
  const { state, sendPrompt, setDraft, reset } = useShellModel();
  const { agent, draft, live, shell } = state;

  const [interfaceFont, setInterfaceFont] = React.useState(() =>
    readStoredValue("pidesk-font-sans", UI_FONT_OPTIONS[0]!.value),
  );
  const [codeFont, setCodeFont] = React.useState(() =>
    readStoredValue("pidesk-font-mono", CODE_FONT_OPTIONS[0]!.value),
  );

  const activeProject = React.useMemo(
    () => getActiveProjectName(shell.workspace?.projects),
    [shell.workspace?.projects],
  );
  const liveTools = React.useMemo(
    () => Object.values(live.toolsById),
    [live.toolsById],
  );
  const runningTools = liveTools.filter((tool) => tool.status === "running");
  const activityItems = React.useMemo(
    () => [...live.activity].slice(-6).reverse(),
    [live.activity],
  );
  const currentTurn = React.useMemo(
    () =>
      live.turns.find((turn) => turn.id === live.currentTurnId) ??
      live.turns.at(-1) ??
      null,
    [live.currentTurnId, live.turns],
  );
  const reasoningSteps = React.useMemo(
    () =>
      buildReasoningSteps({
        activityCount: activityItems.length,
        git: shell.git,
        projectName: activeProject?.name ?? shell.appName,
        status: agent.status,
        toolNames: liveTools.map((tool) => tool.toolName),
      }),
    [
      activityItems.length,
      activeProject?.name,
      agent.status,
      liveTools,
      shell.appName,
      shell.git,
    ],
  );

  const canSend = draft.trim().length > 0 && agent.status !== "streaming";
  const topbarLabel =
    activeProject?.name ??
    getPathTail(shell.workspace?.rootPath) ??
    shell.appName;
  const streamingLabel =
    runningTools.length > 0
      ? `Running ${runningTools.length} tool${runningTools.length === 1 ? "" : "s"}`
      : "Composing the next response";

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
      <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(251,191,36,0.04),transparent_70%)]" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:100px_100px]" />
        </div>

        <aside className="relative z-10 flex w-[18rem] shrink-0 flex-col border-r border-white/8 bg-black/15 backdrop-blur-2xl">
          <div className="px-5 pt-5" data-no-drag="true">
            <Button
              onClick={handleNewThread}
              className="h-12 w-full justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-4 text-[0.82rem] font-medium text-zinc-100 shadow-sm transition hover:border-amber-400/15 hover:bg-white/[0.10]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Plus className="size-4" />
                New Thread
              </span>
              <ChevronRight className="size-4 text-zinc-500" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-8 px-5 py-6">
              <section className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                    Workspace envelope
                  </p>
                  <h1 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-zinc-100">
                    {activeProject?.name ?? shell.appName}
                  </h1>
                  <p className="text-xs leading-5 text-zinc-400/90">
                    {shell.workspace?.rootPath ??
                      "No workspace metadata is available yet."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-[0.68rem] text-zinc-300/80">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                    {formatPlatform(String(shell.platform))}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 capitalize">
                    {shell.runtime?.agentMode ?? "unknown"} mode
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-3 text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                  Session
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                    <p className="text-[0.65rem] text-zinc-500">Messages</p>
                    <p className="mt-1 text-[1.15rem] font-semibold tabular-nums text-zinc-100">
                      {agent.messages.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5">
                    <p className="text-[0.65rem] text-zinc-500">Turns</p>
                    <p className="mt-1 text-[1.15rem] font-semibold tabular-nums text-zinc-100">
                      {live.turns.length}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                  Capabilities
                </p>
                <div className="space-y-1.5 text-sm text-zinc-300">
                  {[
                    {
                      label: "Turns",
                      enabled: shell.capabilities?.supportsTurns,
                    },
                    {
                      label: "Tools",
                      enabled: shell.capabilities?.supportsTools,
                    },
                    {
                      label: "Activity",
                      enabled: shell.capabilities?.supportsActivity,
                    },
                  ].map((capability) => (
                    <div
                      key={capability.label}
                      className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="text-zinc-300">{capability.label}</span>
                      <span
                        className={cn(
                          "size-1.5 rounded-full transition-colors",
                          capability.enabled
                            ? "bg-emerald-400/80"
                            : "bg-zinc-600",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>

          <div
            className="mt-auto border-t border-white/8 px-5 py-5"
            data-no-drag="true"
          >
            <div className="flex items-end justify-between gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.09]"
                    aria-label="Open settings"
                  >
                    <Settings2 className="size-4.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="top"
                  className="w-[18rem] rounded-[1.5rem] border-white/10 bg-[rgba(18,18,22,0.96)] p-4 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
                >
                  <div className="space-y-4">
                    <div>
                      <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                        Settings
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        Refine the interface typography without leaving the
                        workspace.
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
                <p className="text-[0.62rem] uppercase tracking-[0.4em] text-zinc-600">
                  v{shell.appVersion || "0.1.0"}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                  {shell.runtime?.agentMode
                    ? `${shell.runtime.agentMode} agent`
                    : "Desktop shell"}
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
            <div className="min-w-0">
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                Current desk
              </p>
              <p className="truncate text-sm text-zinc-300">{topbarLabel}</p>
            </div>

            <div className="pointer-events-none absolute inset-x-0 flex justify-center">
              <div
                aria-hidden="true"
                className="pt-4 text-[1.35rem] font-semibold tracking-[-0.08em] text-zinc-100/95"
              >
                π
              </div>
            </div>

            <div className="flex items-center gap-2" data-no-drag="true">
              <div
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
                {formatAgentStatus(agent.status)}
              </div>
            </div>
          </header>

          <ChatContainerRoot className="relative min-h-0 flex-1">
            <ChatContainerContent className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-40 pt-10">
              {agent.messages.length === 0 ? (
                <section className="flex-1 pt-10 pb-4">
                  <div className="max-w-2xl space-y-7">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] text-amber-300/80">
                      <Sparkles className="size-3.5 text-amber-400/70" />
                      PiDesk
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-[clamp(1.75rem,3vw,2.6rem)] font-semibold leading-[1.05] tracking-[-0.05em] text-zinc-50">
                        Ask PiDesk to read the room before it writes the next
                        line.
                      </h2>
                      <p className="text-sm leading-7 text-zinc-400">
                        An AI desktop shell built on prompt-kit primitives with
                        observable tool feedback and git-aware context.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {PROMPT_SUGGESTIONS.map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="ghost"
                          className="h-auto w-full items-center justify-start rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left text-sm leading-6 text-zinc-400 transition hover:border-white/12 hover:bg-white/[0.06] hover:text-zinc-200"
                          onClick={() => setDraft(suggestion)}
                        >
                          <span className="block whitespace-normal break-words">
                            {suggestion}
                          </span>
                        </Button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-white/6 pt-5">
                      <PreparedBullet
                        icon={Workflow}
                        title="Prompt-kit chat shell"
                        detail="Message, prompt input, reasoning, chain-of-thought, and tool primitives."
                      />
                      <PreparedBullet
                        icon={GitCompareArrows}
                        title="Git-aware context"
                        detail="Repository, branch, commit, and working-tree state in the inspector."
                      />
                      <PreparedBullet
                        icon={Waypoints}
                        title="Streaming scaffold"
                        detail="Observable milestones surface without leaking hidden chain-of-thought."
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <>
                  {agent.messages.map((message) => {
                    const isUser = message.role === "user";
                    const isSystem = message.role === "system";

                    return (
                      <Message
                        key={message.id}
                        className={cn(
                          "w-full items-start gap-4 px-0",
                          isUser && "flex-row-reverse",
                          isSystem && "justify-center",
                        )}
                      >
                        {!isSystem && (
                          <MessageAvatar
                            src=""
                            alt={getMessageLabel(message)}
                            fallback={getMessageFallback(message)}
                            className={cn(
                              "mt-1 border border-white/10 bg-white/[0.03] shadow-[0_12px_32px_rgba(0,0,0,0.18)]",
                              isUser && "border-white/14 bg-white/[0.08]",
                            )}
                          />
                        )}

                        <div
                          className={cn(
                            "min-w-0 space-y-2",
                            isUser
                              ? "flex flex-col items-end"
                              : "flex flex-col items-start",
                            isSystem && "items-center",
                          )}
                        >
                          {!isSystem && (
                            <div className="px-1 text-[0.7rem] uppercase tracking-[0.18em] text-zinc-500">
                              {getMessageLabel(message)}
                            </div>
                          )}

                          <MessageContent
                            markdown
                            className={cn(
                              "max-w-[min(44rem,100%)] rounded-[1.6rem] border px-5 py-4 text-[0.95rem] leading-7 shadow-[0_22px_70px_rgba(0,0,0,0.14)]",
                              isSystem &&
                                "rounded-full border-white/8 bg-white/[0.03] px-4 py-2 text-xs text-zinc-400 shadow-none",
                              isUser
                                ? "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.07))] text-zinc-50"
                                : "border-white/8 bg-white/[0.045] text-zinc-100",
                            )}
                          >
                            {message.text || " "}
                          </MessageContent>

                          {!isSystem && (
                            <MessageActions
                              className={cn(
                                "px-1 text-[0.72rem] text-zinc-500",
                                isUser ? "justify-end" : "justify-start",
                              )}
                            >
                              <span>{formatTimestamp(message.timestamp)}</span>
                              {message.status !== "complete" && (
                                <span className="rounded-full border border-white/10 px-2 py-0.5 uppercase tracking-[0.18em] text-[0.62rem] text-zinc-400">
                                  {message.status}
                                </span>
                              )}
                            </MessageActions>
                          )}
                        </div>
                      </Message>
                    );
                  })}
                </>
              )}

              {agent.status === "streaming" && (
                <div className="max-w-2xl pl-12">
                  <ThinkingBar
                    text={streamingLabel}
                    className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                  />
                </div>
              )}

              {agent.lastError && (
                <div className="max-w-2xl pl-12">
                  <div className="rounded-[1.4rem] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-4 text-rose-200" />
                      <div className="space-y-2">
                        <p className="font-medium">
                          Agent runtime needs attention
                        </p>
                        <p className="text-rose-100/80">{agent.lastError}</p>
                        <Button
                          variant="ghost"
                          className="h-8 rounded-full border border-rose-300/20 bg-rose-300/10 px-3 text-xs text-rose-50 hover:bg-rose-300/15"
                          onClick={() => void reset()}
                        >
                          <RefreshCcw className="size-3.5" />
                          Refresh desk
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ChatContainerScrollAnchor />
            </ChatContainerContent>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/95 to-transparent" />

            <div
              className="absolute inset-x-0 bottom-0 px-6 pb-6"
              data-no-drag="true"
            >
              <div className="mx-auto max-w-4xl">
                <PromptInput
                  className="pointer-events-auto rounded-[1.8rem] border-white/10 bg-[rgba(20,20,24,0.92)] p-3 shadow-[0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                  value={draft}
                  onValueChange={setDraft}
                  onSubmit={handleSend}
                  isLoading={agent.status === "streaming"}
                  disabled={agent.status === "starting"}
                >
                  <PromptInputTextarea
                    placeholder={
                      activeProject
                        ? `Ask PiDesk about ${activeProject.name}, your repo, or the next implementation step…`
                        : "Ask PiDesk about the current workspace…"
                    }
                    className="min-h-[68px] px-3 pb-2 pt-1 text-[0.95rem] leading-7 placeholder:text-zinc-500"
                    disabled={agent.status === "starting"}
                  />

                  <div className="mt-3 flex items-end justify-between gap-4 px-1 pb-1">
                    <div className="space-y-2">
                      <PromptInputActions className="gap-2">
                        <PromptInputAction tooltip="Start a fresh thread">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleNewThread}
                            className="rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.1]"
                            aria-label="Start a fresh thread"
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </PromptInputAction>

                        <PromptInputAction
                          tooltip={
                            shell.workspace?.rootPath ??
                            "Workspace metadata unavailable"
                          }
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.08]"
                            aria-label="Workspace context"
                          >
                            <FolderCode className="size-3.5" />
                          </Button>
                        </PromptInputAction>
                      </PromptInputActions>

                      <p className="text-[0.7rem] leading-5 text-zinc-600">
                        Enter to send · Shift+Enter for new line
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleSend}
                      disabled={!canSend}
                      className="h-11 rounded-full bg-amber-500/90 px-5 font-medium text-amber-950 shadow-[0_6px_20px_rgba(245,158,11,0.22)] transition hover:bg-amber-400 active:bg-amber-600 disabled:bg-white/[0.05] disabled:text-zinc-600 disabled:shadow-none"
                    >
                      <ArrowUp className="size-4" />
                      Send
                    </Button>
                  </div>
                </PromptInput>
              </div>
            </div>
          </ChatContainerRoot>
        </main>

        <aside className="relative z-10 flex w-[22rem] shrink-0 flex-col border-l border-white/8 bg-black/12 backdrop-blur-2xl">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-6">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-600">
                Inspector
              </p>
              <h2 className="text-sm font-medium text-zinc-200">
                Repository &amp; reasoning
              </h2>
            </div>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 p-6">
              <RepositoryPanel git={shell.git} />

              <Card className="rounded-[1.6rem] border-white/8 bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-zinc-100">
                    <Waypoints className="size-4 text-zinc-300" />
                    Streaming scaffold
                  </CardTitle>
                  <CardDescription className="text-xs leading-5 text-zinc-500">
                    Prepared for future chain-of-thought streaming. Today it
                    shows observable milestones only.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Reasoning
                    isStreaming={agent.status === "streaming"}
                    className="space-y-3"
                  >
                    <ReasoningTrigger className="text-[0.68rem] uppercase tracking-[0.2em] text-zinc-400">
                      Reveal milestone flow
                    </ReasoningTrigger>
                    <ReasoningContent contentClassName="space-y-4 pt-3">
                      <ChainOfThought className="space-y-2">
                        {reasoningSteps.map((step, index) => (
                          <ChainOfThoughtStep
                            key={step.id}
                            defaultOpen={
                              agent.status === "streaming"
                                ? index >= 1
                                : index === 0
                            }
                          >
                            <ChainOfThoughtTrigger
                              leftIcon={
                                <span
                                  className={cn(
                                    "size-2 rounded-full",
                                    step.isActive
                                      ? "bg-amber-200"
                                      : "bg-zinc-500",
                                  )}
                                />
                              }
                            >
                              {step.title}
                            </ChainOfThoughtTrigger>
                            <ChainOfThoughtContent>
                              <ChainOfThoughtItem className="max-w-[18rem] text-xs leading-6 text-zinc-400">
                                {step.detail}
                              </ChainOfThoughtItem>
                            </ChainOfThoughtContent>
                          </ChainOfThoughtStep>
                        ))}
                      </ChainOfThought>
                    </ReasoningContent>
                  </Reasoning>
                </CardContent>
              </Card>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                      Observable tools
                    </p>
                    <p className="mt-1 text-sm text-zinc-200">
                      Prompt-kit tool surfaces
                    </p>
                  </div>
                  <span className="text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
                    {liveTools.length}
                  </span>
                </div>

                {liveTools.length > 0 ? (
                  liveTools.map((tool) => (
                    <Tool
                      key={tool.toolCallId}
                      toolPart={toToolPart(tool)}
                      defaultOpen={tool.status === "running"}
                    />
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-500">
                    Tool executions will appear here with input, output, and
                    error details once the agent begins orchestrating work.
                  </div>
                )}
              </section>

              <Separator className="bg-white/8" />

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
                      Activity cadence
                    </p>
                    <p className="mt-1 text-sm text-zinc-200">
                      Recent renderer events
                    </p>
                  </div>
                  <span className="text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
                    {activityItems.length}
                  </span>
                </div>

                {activityItems.length > 0 ? (
                  <div className="space-y-4">
                    {activityItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="mt-2 size-1.5 shrink-0 rounded-full bg-zinc-400" />
                        <div className="min-w-0 space-y-1">
                          <p className="text-[0.72rem] uppercase tracking-[0.18em] text-zinc-300">
                            {item.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs leading-5 text-zinc-500">
                            {formatTimestamp(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-500">
                    Once a turn begins, PiDesk will log milestones here so the
                    right column stays useful even without a repository.
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>

          <footer className="border-t border-white/8 px-6 py-5">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>v{shell.appVersion || "0.1.0"}</span>
              <span className="uppercase tracking-[0.24em]">
                {currentTurn?.status ?? "idle"}
              </span>
            </div>
          </footer>
        </aside>
      </div>
    </TooltipProvider>
  );
}

function PreparedBullet({
  detail,
  icon: _Icon,
  title,
}: {
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-400/60" />
      <div>
        <span className="text-xs font-medium text-zinc-300">{title}</span>
        <span className="ml-1.5 text-xs text-zinc-600">{detail}</span>
      </div>
    </div>
  );
}

function RepositoryPanel({ git }: { git?: ShellGitSnapshot }) {
  if (!git || git.status === "not_repo") {
    return (
      <Card className="rounded-[1.6rem] border-dashed border-white/10 bg-white/[0.03] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-zinc-100">
            <CircleSlash className="size-4 text-zinc-300" />
            No repository detected
          </CardTitle>
          <CardDescription className="text-xs leading-5 text-zinc-500">
            This workspace is not currently inside a git directory.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 text-sm leading-6 text-zinc-400">
          PiDesk will fall back to workspace and activity context until a
          repository becomes available.
        </CardContent>
      </Card>
    );
  }

  if (git.status === "unavailable") {
    return (
      <Card className="rounded-[1.6rem] border border-amber-300/20 bg-amber-300/10 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-zinc-50">
            <AlertTriangle className="size-4 text-amber-100" />
            Git is unavailable
          </CardTitle>
          <CardDescription className="text-xs leading-5 text-amber-50/80">
            The desktop shell could not inspect git state for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 text-sm leading-6 text-amber-50/90">
          {git.message ?? "No further diagnostic message was provided."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[1.6rem] border-white/8 bg-white/[0.04] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-zinc-500">
              Repository
            </p>
            <CardTitle className="mt-2 flex items-center gap-2 text-sm text-zinc-100">
              <GitBranch className="size-4 text-zinc-300" />
              {getPathTail(git.rootPath)}
            </CardTitle>
          </div>

          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-emerald-300">
            Attached
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="grid grid-cols-2 gap-3">
          <RepositoryMeta
            icon={GitBranch}
            label="Branch"
            value={
              git.branch && git.branch !== "(detached)"
                ? git.branch
                : "Detached HEAD"
            }
          />
          <RepositoryMeta
            icon={GitCommitHorizontal}
            label="Commit"
            value={git.commit ?? "No commits yet"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <RepositoryTag
            label={
              git.hasChanges ? "Working tree changed" : "Working tree clean"
            }
          />
          {(git.ahead ?? 0) > 0 && (
            <RepositoryTag label={`Ahead ${git.ahead}`} />
          )}
          {(git.behind ?? 0) > 0 && (
            <RepositoryTag label={`Behind ${git.behind}`} />
          )}
          {(git.stagedCount ?? 0) > 0 && (
            <RepositoryTag label={`Staged ${git.stagedCount}`} />
          )}
          {(git.modifiedCount ?? 0) > 0 && (
            <RepositoryTag label={`Modified ${git.modifiedCount}`} />
          )}
          {(git.untrackedCount ?? 0) > 0 && (
            <RepositoryTag label={`Untracked ${git.untrackedCount}`} />
          )}
        </div>

        <div className="rounded-[1.2rem] border border-white/8 bg-black/15 px-4 py-3 text-xs leading-6 text-zinc-400">
          {git.rootPath}
        </div>
      </CardContent>
    </Card>
  );
}

function RepositoryMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-black/15 px-4 py-3">
      <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-500">
        <Icon className="size-3.5 text-zinc-400" />
        {label}
      </div>
      <p className="mt-2 break-all text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function RepositoryTag({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const isChanged =
    lower.includes("changed") ||
    lower.includes("modified") ||
    lower.includes("staged") ||
    lower.includes("untracked");
  const isClean = lower.includes("clean");

  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.18em]",
        isClean
          ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400/80"
          : isChanged
            ? "border-amber-400/20 bg-amber-400/8 text-amber-300/80"
            : "border-white/10 bg-white/[0.04] text-zinc-400",
      )}
    >
      {label}
    </span>
  );
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
    <label className="block space-y-2 text-sm text-zinc-300">
      <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-zinc-100 outline-none transition focus:border-white/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
