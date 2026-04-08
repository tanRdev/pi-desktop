import type { AgentMessageSnapshot } from "@pidesk/shared";
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@pidesk/ui";
import * as React from "react";
import { cn } from "@/lib/utils";
import { FeedbackBar, type FeedbackValue } from "../ui/feedback-bar";
import { At, Paperclip, Plus, Star, Stop, X } from "../ui/icons";
import { Loader } from "../ui/loader";
import { MessageContent } from "../ui/message";
import { ScrollButton } from "../ui/scroll-button";
import { SystemMessage } from "../ui/system-message";
import { Tool } from "../ui/tool";

// ---------------------------------------------------------------------------
// Skill types
// ---------------------------------------------------------------------------

export interface Skill {
  id: string;
  label: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Slash command parser
// ---------------------------------------------------------------------------

function parseSlashCommand(text: string): string | null {
  const match = /^\/([a-zA-Z0-9_-]*)/.exec(text);
  return match !== null ? (match[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// SkillItem
// ---------------------------------------------------------------------------

interface SkillItemProps {
  skill: Skill;
  isSelected: boolean;
  onSelect: (skill: Skill) => void;
}

function SkillItem({ skill, isSelected, onSelect }: SkillItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-3 py-2 text-left transition-colors",
        isSelected
          ? "bg-white/[0.07] text-white/90"
          : "text-white/60 hover:bg-white/[0.04] hover:text-white/80",
      )}
      onMouseDown={(e) => {
        // prevent textarea blur
        e.preventDefault();
        onSelect(skill);
      }}
    >
      <span className="mt-px text-[12px] font-mono text-amber-400/80">
        /{skill.label}
      </span>
      {skill.description && (
        <span className="text-[11px] text-white/40 leading-relaxed">
          {skill.description}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SkillsDropdown
// ---------------------------------------------------------------------------

interface SkillsDropdownProps {
  skills: Skill[];
  filter: string;
  selectedIndex: number;
  onSelect: (skill: Skill) => void;
}

function SkillsDropdown({
  skills,
  filter,
  selectedIndex,
  onSelect,
}: SkillsDropdownProps) {
  const filtered = React.useMemo(
    () =>
      filter
        ? skills.filter(
            (s) =>
              s.label.toLowerCase().startsWith(filter.toLowerCase()) ||
              s.description?.toLowerCase().includes(filter.toLowerCase()),
          )
        : skills,
    [skills, filter],
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--color-bg-secondary)]/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.map((skill, index) => (
          <SkillItem
            key={skill.id}
            skill={skill}
            isSelected={index === selectedIndex}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CursorChatInput
// ---------------------------------------------------------------------------

interface CursorChatInputProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void | Promise<void>;
  onCancelPrompt: () => void | Promise<void>;
  canSend: boolean;
  isPromptExecuting: boolean;
  skills?: Skill[];
  onSkillSelect?: (skill: Skill) => void;
}

function CursorChatInput({
  draft,
  onDraftChange,
  onSend,
  onCancelPrompt,
  canSend,
  isPromptExecuting,
  skills = [],
  onSkillSelect,
}: CursorChatInputProps) {
  const [showSkills, setShowSkills] = React.useState(false);
  const [skillSelectedIndex, setSkillSelectedIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const slashFilter = parseSlashCommand(draft);
  const isSlashCommand = slashFilter !== null;

  React.useEffect(() => {
    setShowSkills(isSlashCommand && skills.length > 0);
    setSkillSelectedIndex(0);
  }, [isSlashCommand, skills.length]);

  // Auto-resize textarea — runs after every render where draft changed
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  });

  const filteredSkills = React.useMemo(
    () =>
      slashFilter !== null
        ? skills.filter(
            (s) =>
              s.label.toLowerCase().startsWith(slashFilter.toLowerCase()) ||
              s.description?.toLowerCase().includes(slashFilter.toLowerCase()),
          )
        : skills,
    [skills, slashFilter],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSkills && filteredSkills.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSkillSelectedIndex((i) =>
            Math.min(i + 1, filteredSkills.length - 1),
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSkillSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Tab" || (e.key === "Enter" && showSkills)) {
          e.preventDefault();
          const skill = filteredSkills[skillSelectedIndex];
          if (skill) {
            onSkillSelect?.(skill);
            onDraftChange(`/${skill.label} `);
            setShowSkills(false);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSkills(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend && !isPromptExecuting) {
          void onSend();
        }
      }
    },
    [
      showSkills,
      filteredSkills,
      skillSelectedIndex,
      canSend,
      isPromptExecuting,
      onSend,
      onDraftChange,
      onSkillSelect,
    ],
  );

  const handleSkillSelect = React.useCallback(
    (skill: Skill) => {
      onSkillSelect?.(skill);
      onDraftChange(`/${skill.label} `);
      setShowSkills(false);
      textareaRef.current?.focus();
    },
    [onSkillSelect, onDraftChange],
  );

  const planCount = React.useMemo(() => {
    const matches = draft.match(/\bplan\b/gi);
    return matches ? matches.length : 0;
  }, [draft]);

  return (
    <div className="relative flex flex-col">
      {/* Skills dropdown */}
      {showSkills && filteredSkills.length > 0 && (
        <SkillsDropdown
          skills={skills}
          filter={slashFilter ?? ""}
          selectedIndex={skillSelectedIndex}
          onSelect={handleSkillSelect}
        />
      )}

      {/* Input area */}
      <div className="flex flex-col gap-2 pt-4 pb-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask PiDesk anything... (/ for commands)"
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent px-3 text-[14px] leading-relaxed text-white/90",
            "placeholder:text-white/25 focus:outline-none",
            "min-h-[22px]",
          )}
        />

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              title="Attach file"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              title="Attach file"
            >
              <Paperclip className="size-3.5" />
            </button>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.05] hover:text-white/60"
              title="Mention"
            >
              <At className="size-3.5" />
            </button>

            {planCount > 0 && (
              <div className="ml-1 flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
                <span className="text-[11px] text-white/40">
                  Plan: {planCount}
                </span>
                <button
                  type="button"
                  className="text-white/20 hover:text-white/50"
                  onClick={() =>
                    onDraftChange(draft.replace(/\bplan\b/gi, "").trim())
                  }
                >
                  <X className="size-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Send / Stop */}
          {isPromptExecuting ? (
            <button
              type="button"
              onClick={() => void onCancelPrompt()}
              className="flex size-7 items-center justify-center rounded-md bg-white/[0.06] text-white/50 transition-colors hover:bg-white/[0.1] hover:text-white/80"
              title="Stop"
            >
              <Stop className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSend()}
              disabled={!canSend}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all",
                canSend
                  ? "bg-white/[0.08] text-white/80 hover:bg-white/[0.12] hover:text-white"
                  : "cursor-not-allowed bg-white/[0.03] text-white/20",
              )}
              title="Send"
            >
              <Star className="size-3" />
              <span>Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

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

function buildToolPart(message: AgentMessageSnapshot) {
  return {
    type: "workspace.tool",
    state:
      message.status === "error"
        ? "output-error"
        : message.status === "streaming"
          ? "input-streaming"
          : "output-available",
    output: { transcript: message.text || "No tool output yet." },
    errorText: message.status === "error" ? message.text : undefined,
  } as const;
}

// Slash command highlighter component
interface SlashCommandHighlighterProps {
  text: string;
}

function SlashCommandHighlighter({ text }: SlashCommandHighlighterProps) {
  const parts = text.split(/(\/[a-zA-Z0-9_-]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("/")) {
          return (
            <span key={i} className="text-amber-400/90 font-mono">
              {part}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export interface ChatThreadPanelProps {
  threadTitle: string;
  messages: AgentMessageSnapshot[];
  isStreaming: boolean;
  lastError: string | null;
  className?: string;
  // Context bar
  contextPath?: string;
  contextLabel?: string;
  // Input
  draft?: string;
  onDraftChange?: (draft: string) => void;
  onSend?: () => void | Promise<void>;
  onCancelPrompt?: () => void | Promise<void>;
  canSend?: boolean;
  isPromptExecuting?: boolean;
  skills?: Skill[];
  onSkillSelect?: (skill: Skill) => void;
}

export function ChatThreadPanel({
  threadTitle: _threadTitle,
  messages,
  isStreaming,
  lastError,
  className,
  contextPath = "tan/dev/pidesk",
  contextLabel = "frontend-design",
  draft = "",
  onDraftChange,
  onSend,
  onCancelPrompt,
  canSend = false,
  isPromptExecuting = false,
  skills,
  onSkillSelect,
}: ChatThreadPanelProps) {
  const [feedbackByMessageId, setFeedbackByMessageId] = React.useState<
    Record<string, FeedbackValue>
  >({});
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const [queuedMessageCount, setQueuedMessageCount] = React.useState(0);
  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = React.useRef(messages.length);

  React.useEffect(() => {
    if (showScrollButton && messages.length > previousMessageCountRef.current) {
      setQueuedMessageCount((currentCount) => currentCount + 1);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages.length, showScrollButton]);

  const handleTranscriptScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      scrollViewportRef.current = viewport;

      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const shouldShow = distanceFromBottom > 100;

      setShowScrollButton(shouldShow);
      if (!shouldShow) {
        setQueuedMessageCount(0);
      }
    },
    [],
  );

  const handleJumpToLatest = React.useCallback(() => {
    scrollViewportRef.current?.scrollTo({
      top: scrollViewportRef.current.scrollHeight,
      behavior: "smooth",
    });
    setShowScrollButton(false);
    setQueuedMessageCount(0);
  }, []);

  const handleFeedbackChange = React.useCallback(
    (messageId: string, value: FeedbackValue) => {
      setFeedbackByMessageId((currentState) => ({
        ...currentState,
        [messageId]: value,
      }));
    },
    [],
  );

  const handleCopyMessage = React.useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col bg-[var(--shell-main-bg)]",
        className,
      )}
    >
      {/* Messages area */}
      <ChatContainerRoot
        className="min-h-0 flex-1"
        onScroll={handleTranscriptScroll}
      >
        <ChatContainerContent
          data-testid="chat-transcript"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-48 pt-6"
        >
          {messages.length === 0
            ? // Cursor Glass: completely empty, no placeholder text
              null
            : messages.map((message, index) => {
                const isSystem = message.role === "system";
                const isTool = message.role === "tool";
                const isAssistant = message.role === "assistant";
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "group flex gap-3",
                      isUser && "flex-row-reverse",
                      (isSystem || isTool) && "justify-center",
                      "stagger-item",
                    )}
                    style={{ animationDelay: `${(index % 8) * 30}ms` }}
                  >
                    {/* Avatar - Cursor style */}
                    {isAssistant && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
                        <span className="text-[10px] font-semibold text-white/40">
                          PI
                        </span>
                      </div>
                    )}
                    {isUser && (
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                        <span className="text-[10px] font-medium text-white">
                          Y
                        </span>
                      </div>
                    )}

                    {/* Message content */}
                    <div
                      className={cn(
                        "min-w-0 flex-1 space-y-1",
                        isUser && "max-w-[90%]",
                        isAssistant && "max-w-[90%]",
                        (isSystem || isTool) && "max-w-xl flex-initial",
                      )}
                    >
                      {/* Sender label */}
                      {!isSystem && !isTool && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-white/30">
                            {getMessageLabel(message)}
                          </span>
                          {isAssistant && message.status === "streaming" && (
                            <span className="flex size-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                          )}
                        </div>
                      )}

                      {/* Message body */}
                      <div
                        className={cn(
                          "text-[14px] leading-relaxed",
                          isUser && "text-white/90",
                          isAssistant && "text-white/90",
                          (isSystem || isTool) && "text-white/40",
                        )}
                      >
                        {isSystem ? (
                          <SystemMessage
                            tone={message.status === "error" ? "error" : "info"}
                            title="System"
                          >
                            {message.text}
                          </SystemMessage>
                        ) : isTool ? (
                          <div className="max-w-xl">
                            <Tool
                              toolPart={buildToolPart(message)}
                              defaultOpen={message.status !== "complete"}
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {message.role === "user" ? (
                              <div className="prose prose-invert max-w-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[14px] leading-relaxed text-white/90">
                                <SlashCommandHighlighter
                                  text={message.text || " "}
                                />
                              </div>
                            ) : (
                              <MessageContent
                                markdown={true}
                                className="prose prose-invert max-w-none"
                              >
                                {message.text || " "}
                              </MessageContent>
                            )}

                            {isAssistant && (
                              <div className="flex items-center gap-2 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <FeedbackBar
                                  value={
                                    feedbackByMessageId[message.id] ?? null
                                  }
                                  onValueChange={(value) =>
                                    handleFeedbackChange(message.id, value)
                                  }
                                  onCopy={() => handleCopyMessage(message.text)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <Loader label="Responding" />
              <span className="text-xs text-white/30">Responding...</span>
            </div>
          )}

          {/* Error message */}
          {lastError && (
            <SystemMessage tone="error" title="Error">
              {lastError}
            </SystemMessage>
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Scroll button — above input */}
      {showScrollButton && (
        <div className="pointer-events-none absolute bottom-32 right-6 z-10">
          <ScrollButton
            className="pointer-events-auto"
            count={queuedMessageCount}
            onClick={handleJumpToLatest}
          >
            Jump to latest
          </ScrollButton>
        </div>
      )}

      {/* CursorChatInput — pinned to bottom */}
      {onDraftChange && onSend && onCancelPrompt && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d] to-transparent">
          <div className="overflow-hidden border-t border-white/[0.03] bg-[var(--color-bg-secondary)]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
            <CursorChatInput
              draft={draft}
              onDraftChange={onDraftChange}
              onSend={onSend}
              onCancelPrompt={onCancelPrompt}
              canSend={canSend}
              isPromptExecuting={isPromptExecuting}
              skills={skills}
              onSkillSelect={onSkillSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}
