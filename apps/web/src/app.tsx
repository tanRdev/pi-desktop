"use client";

import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  History,
  FolderGit,
  FolderTree,
  Plus,
  Settings2,
} from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./components/ui/button";
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
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Todo } from "./components/ui/todo";
import { TooltipProvider } from "./components/ui/tooltip";

// Types for conversation instances
interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  timestamp: number;
  status?: "complete" | "streaming" | "error";
}

interface ConversationInstance {
  id: string;
  title: string;
  messages: AgentMessage[];
  timestamp: number;
  model: string;
}

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
  "Outline the active agent capabilities in this web shell.",
];

// Model options for selector
const MODEL_OPTIONS = [
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku", label: "Claude 3.5 Haiku" },
  { value: "claude-4-sonnet", label: "Claude 4 Sonnet" },
  { value: "claude-4-opus", label: "Claude 4 Opus" },
];

// Agent mode options for selector
const AGENT_MODES = [
  { value: "general", label: "General" },
  { value: "plan", label: "Plan" },
  { value: "code", label: "Code" },
  { value: "debug", label: "Debug" },
];

type ViewType = "git" | "files" | "context" | "history";

// Mock instances for UI testing
const MOCK_INSTANCES: ConversationInstance[] = [
  {
    id: "instance-1",
    title: "Fix authentication bug",
    messages: [],
    timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago
    model: "claude-3-5-sonnet",
  },
  {
    id: "instance-2",
    title: "Review API changes",
    messages: [],
    timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
    model: "claude-3-5-sonnet",
  },
  {
    id: "instance-3",
    title: "New conversation",
    messages: [],
    timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
    model: "claude-3-5-sonnet",
  },
];

// System resource mocks
const MOCK_MEMORY_USAGE = "142 MB";
const MOCK_CPU_USAGE = "2%";
const MOCK_CONTEXT_PERCENTAGE = 45;

function readStoredValue(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function formatRelativeTime(timestamp: number): string {
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

function getMessageLabel(message: AgentMessage) {
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

function getMessageFallback(message: AgentMessage) {
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

function generateInstanceTitle(messages: AgentMessage[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (firstUserMessage && typeof firstUserMessage.text === "string") {
    const content = firstUserMessage.text;
    // Truncate to first 40 chars or first line
    const title = content.split("\n")[0].slice(0, 40);
    return title.length < content.length ? `${title}...` : title;
  }
  return "New conversation";
}

function SettingsSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[0.6rem] uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

export default function App() {
  // Active view state for right sidebar
  const [activeView, setActiveView] = React.useState<ViewType>("git");

  // Conversation instances state
  const [instances, setInstances] =
    React.useState<ConversationInstance[]>(MOCK_INSTANCES);
  const [activeInstanceId, setActiveInstanceId] = React.useState<string>(
    MOCK_INSTANCES[0]!.id,
  );
  const [draft, setDraft] = React.useState("");

  // Model and agent mode state
  const [selectedModel, setSelectedModel] = React.useState(MODEL_OPTIONS[0]!.value);
  const [agentMode, setAgentMode] = React.useState(AGENT_MODES[0]!.value);

  const activeInstance = React.useMemo(
    () => instances.find((i) => i.id === activeInstanceId) ?? instances[0],
    [instances, activeInstanceId],
  );

  const [interfaceFont, setInterfaceFont] = React.useState(() =>
    readStoredValue("pidesk-font-sans", UI_FONT_OPTIONS[0]!.value),
  );
  const [codeFont, setCodeFont] = React.useState(() =>
    readStoredValue("pidesk-font-mono", CODE_FONT_OPTIONS[0]!.value),
  );

  const canSend = draft.trim().length > 0;

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

    // Create a new user message
    const newMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      text: draft,
      status: "complete",
      timestamp: Date.now(),
    };

    // Update the active instance with the new message
    setInstances((prev) =>
      prev.map((instance) =>
        instance.id === activeInstanceId
          ? {
              ...instance,
              messages: [...instance.messages, newMessage],
              title:
                instance.title === "New conversation"
                  ? generateInstanceTitle([...instance.messages, newMessage])
                  : instance.title,
              timestamp: Date.now(),
            }
          : instance,
      ),
    );

    setDraft("");
  }, [canSend, draft, activeInstanceId]);

  const handleNewThread = React.useCallback(() => {
    const newInstance: ConversationInstance = {
      id: `instance-${Date.now()}`,
      title: "New conversation",
      messages: [],
      timestamp: Date.now(),
      model: "claude-3-5-sonnet",
    };
    setInstances((prev) => [newInstance, ...prev]);
    setActiveInstanceId(newInstance.id);
    setDraft("");
  }, []);

  const handleInstanceClick = React.useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId);
  }, []);

  return (
    <TooltipProvider>
      <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:100px_100px]" />
        </div>

        {/* Left Sidebar */}
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
              {/* Workspace Section */}
              <section className="space-y-2">
                <div className="space-y-1">
                  <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                    Workspace
                  </p>
                  <h1 className="text-sm font-medium tracking-[-0.01em] text-zinc-100">
                    PiDesk Web
                  </h1>
                </div>

                {/* System Resource Usage */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">Memory</span>
                    <span className="text-zinc-300">{MOCK_MEMORY_USAGE}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">CPU</span>
                    <span className="text-zinc-300">{MOCK_CPU_USAGE}</span>
                  </div>
                </div>

                <p className="text-[11px] leading-4 text-zinc-500 truncate">
                  /Users/tan/projects/pidesk
                </p>
              </section>

              {/* Session Section */}
              <section className="space-y-1.5">
                <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                  Session
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Messages
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      {activeInstance?.messages.length ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Context
                    </span>
                    <span className="text-[11px] text-zinc-300">
                      {MOCK_CONTEXT_PERCENTAGE}%
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-0.5">
                    {activeInstance?.model ?? "claude-3-5-sonnet"}
                  </p>
                </div>
              </section>

              {/* Instances/Threads Section */}
              <section className="space-y-2">
                <p className="text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">
                  Threads
                </p>
                <div className="space-y-1">
                  {instances.map((instance) => (
                    <button
                      key={instance.id}
                      onClick={() => handleInstanceClick(instance.id)}
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition",
                        "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                        activeInstanceId === instance.id &&
                          "border-white/20 bg-white/[0.08]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-[13px]",
                            activeInstanceId === instance.id
                              ? "text-zinc-100"
                              : "text-zinc-400",
                          )}
                        >
                          {instance.title}
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500">
                          {formatRelativeTime(instance.timestamp)}
                        </span>
                      </div>
                    </button>
                  ))}
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
                  v0.1.0
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">
                  Web shell
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Header - Redesigned for Mac window bar styling */}
          <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-white/8 px-6 backdrop-blur-xl">
            {/* Left section - empty for Mac traffic lights */}
            <div className="min-w-0 w-32" />

            {/* Center - Pi logo (muted) */}
            <div className="pointer-events-none absolute inset-x-0 flex justify-center">
              <div
                aria-hidden="true"
                className="pt-4 text-[1.35rem] font-semibold tracking-[-0.08em] text-zinc-600"
              >
                π
              </div>
            </div>

            {/* Right section - MCP dropdown placeholder */}
            <div className="flex items-center gap-2" data-no-drag="true">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.18em] text-zinc-400">
                <span className="size-1.5 rounded-full bg-emerald-400/80" />
                Ready
              </div>
            </div>
          </header>

          <ChatContainerRoot className="relative min-h-0 flex-1">
            <ChatContainerContent className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 pb-40 pt-10">
              {(activeInstance?.messages.length ?? 0) === 0 ? (
                // Empty State
                <section className="flex flex-1 flex-col items-center justify-center">
                  {/* Centered Pi logo */}
                  <div className="text-5xl font-semibold tracking-[-0.08em] text-zinc-600 mb-8">
                    π
                  </div>
                </section>
              ) : (
                <>
                  {activeInstance?.messages.map((message) => {
                    const isUser = message.role === "user";
                    const isSystem = message.role === "system";

                    return (
                      <Message
                        key={message.id}
                        className={cn(
                          "[--message-bg:transparent]",
                          isUser && "[--message-bg:transparent]",
                          isSystem &&
                            "my-6 rounded-2xl border border-dashed border-zinc-700/60 bg-zinc-800/30 px-4 py-3 [--message-bg:transparent]",
                        )}
                      >
                        {!isSystem && (
                          <MessageAvatar
                            src={undefined}
                            alt={getMessageLabel(message)}
                            fallback={getMessageFallback(message)}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!isSystem && (
                              <span className="text-xs font-medium text-zinc-400">
                                {getMessageLabel(message)}
                              </span>
                            )}
                          </div>
                          <MessageContent
                            className="mt-1"
                            content={message.text}
                          />
                        </div>
                        <MessageActions>
                          <div className="flex items-center gap-2" />
                        </MessageActions>
                      </Message>
                    );
                  })}
                </>
              )}
              <ChatContainerScrollAnchor />
            </ChatContainerContent>
          </ChatContainerRoot>

          {/* Input Area */}
          <div className="relative z-20 border-t border-white/6 bg-gradient-to-t from-background to-transparent pb-6 pt-4">
            <div className="mx-auto max-w-4xl px-6">
              {/* Prompt suggestions above input */}
              {(activeInstance?.messages.length ?? 0) === 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
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
                onValueChange={(value) => setDraft(value)}
                onSubmit={handleSend}
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl transition focus-within:border-amber-400/20 focus-within:bg-white/[0.06] focus-within:shadow-[0_12px_48px_rgba(0,0,0,0.35)]"
              >
                <PromptInputTextarea
                  placeholder="Ask PiDesk to read the room..."
                  className="min-h-[4.5rem] resize-none border-0 bg-transparent text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
                />
                <PromptInputActions className="mt-3 items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Model Selector */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300">
                          {MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label ?? "Select model"}
                          <ChevronDown className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-48 rounded-lg border border-white/[0.08] bg-[hsl(222,24%,8%)] p-1"
                      >
                        {MODEL_OPTIONS.map((model) => (
                          <button
                            key={model.value}
                            onClick={() => setSelectedModel(model.value)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs",
                              selectedModel === model.value
                                ? "bg-white/[0.08] text-zinc-200"
                                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
                            )}
                          >
                            {model.label}
                            {selectedModel === model.value && <Check className="size-3" />}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>

                    {/* Agent Mode Selector */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300">
                          {AGENT_MODES.find((m) => m.value === agentMode)?.label}
                          <ChevronDown className="size-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-36 rounded-lg border border-white/[0.08] bg-[hsl(222,24%,8%)] p-1"
                      >
                        {AGENT_MODES.map((mode) => (
                          <button
                            key={mode.value}
                            onClick={() => setAgentMode(mode.value)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs",
                              agentMode === mode.value
                                ? "bg-white/[0.08] text-zinc-200"
                                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
                            )}
                          >
                            {mode.label}
                            {agentMode === mode.value && <Check className="size-3" />}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.7rem] text-zinc-500">
                      Enter to send
                    </span>
                    <PromptInputAction tooltip="Send message">
                      <Button
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

        {/* Right Sidebar - Inspector */}
        <aside className="relative z-10 flex w-48 shrink-0 flex-col border-l border-white/[0.06] bg-black/20">
          {/* Icon Header */}
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-2">
            <div className="flex items-center">
              <button
                onClick={() => setActiveView("git")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition",
                  activeView === "git"
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <GitBranch className="size-4" />
              </button>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/[0.08]" />
              <button
                onClick={() => setActiveView("files")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition",
                  activeView === "files"
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <FolderTree className="size-4" />
              </button>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/[0.08]" />
              <button
                onClick={() => setActiveView("context")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition",
                  activeView === "context"
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <FolderGit className="size-4" />
              </button>
              <Separator orientation="vertical" className="mx-1 h-4 bg-white/[0.08]" />
              <button
                onClick={() => setActiveView("history")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition",
                  activeView === "history"
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <History className="size-4" />
              </button>
            </div>
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 p-3">
              {/* Repository - Git View */}
              {activeView === "git" && (
                <section className="space-y-2">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-3.5 text-zinc-400" />
                      <span className="text-xs font-medium text-zinc-300">pidesk-web</span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500">main • clean</p>
                  </div>
                </section>
              )}

              {/* Files View */}
              {activeView === "files" && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500">Files</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-400">
                      <FolderTree className="size-3.5" />
                      <span>src/</span>
                    </div>
                    <div className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-400">
                      <FolderTree className="size-3.5" />
                      <span>components/</span>
                    </div>
                    <div className="flex items-center gap-2 rounded px-2 py-1 text-xs text-zinc-400">
                      <FolderTree className="size-3.5" />
                      <span>lib/</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Context View */}
              {activeView === "context" && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500">Context</p>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-xs text-zinc-400">No additional context loaded</p>
                  </div>
                </section>
              )}

              {/* History View */}
              {activeView === "history" && (
                <section className="space-y-2">
                  <p className="text-[11px] font-medium text-zinc-500">History</p>
                  <div className="space-y-1">
                    <div className="rounded px-2 py-1 text-xs text-zinc-400">
                      Initial commit
                    </div>
                    <div className="rounded px-2 py-1 text-xs text-zinc-400">
                      Setup project
                    </div>
                  </div>
                </section>
              )}

              {/* TODO - Only shows during active session */}
              {(activeInstance?.messages.length ?? 0) > 0 && (
                <section className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tasks</p>
                  <Todo
                    items={[
                      { id: "1", text: "Read workspace context", completed: true },
                      { id: "2", text: "Analyze repository structure", completed: activeInstance?.messages.length ?? 0 > 1 },
                      { id: "3", text: "Implement requested changes", completed: false },
                    ]}
                  />
                </section>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-3 py-2">
            <div className="flex items-center justify-between text-[10px] text-zinc-600">
              <span>v0.1.0</span>
              <span className="uppercase">{activeInstance?.model ?? "claude-3-5-sonnet"}</span>
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  );
}
