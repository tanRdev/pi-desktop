import * as React from "react";
import {
  CaretDown,
  Chat,
  File,
  GitCommit,
  TerminalWindow,
  Upload,
  X,
} from "@/components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getTrafficLightInset } from "../../lib/title-bar-layout";
import {
  type ContextSurfaceKey,
  type ContextWindow,
} from "../../lib/workspace-pane-state";

const COMMIT_PROMPT = "Commit all changes with a conventional-commits message";
const COMMIT_AND_PUSH_PROMPT =
  "Commit all changes with a conventional-commits message and push to origin";
const PUSH_PROMPT = "Push current branch to origin";
const FETCH_PROMPT = "Fetch from origin";

type GitAction = "commit-and-push" | "commit" | "push" | "fetch";

const GIT_ACTIONS: {
  id: GitAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
}[] = [
  {
    id: "commit-and-push",
    label: "Commit & Push",
    icon: GitCommit,
    prompt: COMMIT_AND_PUSH_PROMPT,
  },
  {
    id: "commit",
    label: "Commit",
    icon: GitCommit,
    prompt: COMMIT_PROMPT,
  },
  {
    id: "push",
    label: "Push",
    icon: Upload,
    prompt: PUSH_PROMPT,
  },
  {
    id: "fetch",
    label: "Fetch",
    icon: Upload,
    prompt: FETCH_PROMPT,
  },
];

export interface TitleBarProps {
  platform: string | null;
  onAgentGitAction?: (prompt: string) => void;
  hasActiveThread?: boolean;
  hasChangesToCommit?: boolean;
  hasCommitsToPush?: boolean;
  isPromptExecuting?: boolean;
  onToggleTerminal?: () => void;
  isTerminalVisible?: boolean;
  activeThreadId?: string | null;
  activeThreadTitle?: string | null;
  contextWindows?: ContextWindow[];
  selectedContextSurface?: ContextSurfaceKey | null;
  onSelectContextSurface?: (surfaceKey: ContextSurfaceKey | null) => void;
  onCloseFileWindow?: (windowId: string) => void;
}

interface GitSplitButtonProps {
  onAgentGitAction?: (prompt: string) => void;
  hasActiveThread: boolean;
  hasChangesToCommit: boolean;
  hasCommitsToPush: boolean;
  isPromptExecuting: boolean;
}

function GitSplitButton({
  onAgentGitAction,
  hasActiveThread,
  hasChangesToCommit,
  hasCommitsToPush,
  isPromptExecuting,
}: GitSplitButtonProps) {
  const [selectedAction, setSelectedAction] =
    React.useState<GitAction>("commit-and-push");
  const [menuOpen, setMenuOpen] = React.useState(false);

  const noThread = !hasActiveThread || !onAgentGitAction;

  const isActionDisabled = React.useCallback(
    (action: GitAction) => {
      if (noThread) return true;
      switch (action) {
        case "commit-and-push":
        case "commit":
          return !hasChangesToCommit;
        case "push":
          return !hasCommitsToPush;
        case "fetch":
          return false;
      }
    },
    [noThread, hasChangesToCommit, hasCommitsToPush],
  );

  const currentAction =
    GIT_ACTIONS.find((a) => a.id === selectedAction) ?? GIT_ACTIONS[0];
  const CurrentIcon = currentAction?.icon ?? GitCommit;
  const mainButtonDisabled = isActionDisabled(selectedAction);

  const showGlow = hasChangesToCommit && !isPromptExecuting && !noThread;

  const send = React.useCallback(
    (prompt: string) => {
      onAgentGitAction?.(prompt);
      setMenuOpen(false);
    },
    [onAgentGitAction],
  );

  const mainTitle = noThread
    ? "No active thread"
    : mainButtonDisabled
      ? selectedAction === "commit" || selectedAction === "commit-and-push"
        ? "No changes to commit"
        : selectedAction === "push"
          ? "No commits to push"
          : undefined
      : undefined;

  return (
    <div
      className={cn(
        "flex h-7 items-stretch border border-white/[0.06]",
        noThread && "opacity-40",
      )}
    >
      <button
        type="button"
        disabled={mainButtonDisabled}
        title={mainTitle}
        onClick={() => send(currentAction?.prompt ?? "")}
        className={cn(
          "flex items-center gap-1.5 px-2 text-[10px] uppercase tracking-wider transition-colors duration-150",
          showGlow
            ? "text-green-400 hover:bg-green-500/10 hover:text-green-300"
            : "text-white/70 hover:bg-white/[0.04] hover:text-white/90",
          mainButtonDisabled && "cursor-not-allowed",
          mainButtonDisabled && showGlow
            ? "hover:bg-transparent"
            : mainButtonDisabled && "hover:bg-transparent hover:text-white/70",
          "focus:outline-none focus-visible:outline-none",
        )}
      >
        <CurrentIcon className="size-3.5" />
        <span>{currentAction?.label ?? ""}</span>
      </button>
      <div className="w-px bg-white/[0.06]" aria-hidden="true" />
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={noThread}
            title={noThread ? "No active thread" : undefined}
            aria-label="More git actions"
            className={cn(
              "flex items-center justify-center px-1.5 text-white/70 transition-colors duration-150",
              "hover:bg-white/[0.04] hover:text-white/90",
              "disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/70",
              "focus:outline-none focus-visible:outline-none",
            )}
          >
            <CaretDown className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="w-48 border-white/[0.06] bg-[var(--color-bg-primary)] p-1 shadow-2xl"
        >
          <div className="flex flex-col">
            {GIT_ACTIONS.map((action) => {
              const Icon = action.icon;
              const itemDisabled = isActionDisabled(action.id);
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={itemDisabled}
                  onClick={() => {
                    setSelectedAction(action.id);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-left text-[10px] uppercase tracking-wider transition-colors duration-150",
                    action.id === selectedAction
                      ? "text-white/90 bg-white/[0.04]"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white/90",
                    itemDisabled && "opacity-40 cursor-not-allowed",
                    "focus:outline-none focus-visible:outline-none",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function TitleBarTab({
  tabKey,
  label,
  icon,
  isActive,
  isClosable,
  onSelect,
  onClose,
}: {
  tabKey: string;
  label: string;
  icon: "chat" | "file";
  isActive: boolean;
  isClosable?: boolean;
  onSelect: () => void;
  onClose?: () => void;
}) {
  const Icon = icon === "chat" ? Chat : File;

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      className={cn(
        "group flex h-7 min-w-0 max-w-[160px] items-center gap-1.5 px-2",
        "text-[10px] uppercase tracking-wider transition-colors duration-150",
        "focus:outline-none focus-visible:outline-none cursor-pointer select-none",
        isActive
          ? "text-white/90 border-b border-white/20"
          : "text-white/40 hover:text-white/70 border-b border-transparent",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Icon className="size-3 shrink-0" weight="regular" />
      <span className="truncate">{label}</span>
      {isClosable && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-auto shrink-0 flex size-4 items-center justify-center",
            "text-white/20 hover:text-white/60",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-100",
          )}
          aria-label={`Close ${label}`}
        >
          <X className="size-2.5" weight="bold" />
        </button>
      )}
    </div>
  );
}

export function TitleBar({
  platform,
  onAgentGitAction,
  hasActiveThread = false,
  hasChangesToCommit = false,
  hasCommitsToPush = false,
  isPromptExecuting = false,
  onToggleTerminal,
  isTerminalVisible = false,
  activeThreadId,
  activeThreadTitle,
  contextWindows = [],
  selectedContextSurface,
  onSelectContextSurface,
  onCloseFileWindow,
}: TitleBarProps) {
  const trafficLightInset = getTrafficLightInset(platform);

  const fileWindows = React.useMemo(
    () =>
      contextWindows.filter(
        (w): w is Extract<ContextWindow, { kind: "file" }> => w.kind === "file",
      ),
    [contextWindows],
  );

  const isChatActive =
    selectedContextSurface === null || selectedContextSurface === "activity";

  return (
    <div
      data-drag-region="true"
      className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/[0.03] px-4 select-none"
      style={{ paddingLeft: trafficLightInset }}
    >
      <div
        data-slot="titlebar-tabs"
        data-no-drag="true"
        className="flex min-w-0 items-center gap-0 overflow-x-auto"
        role="tablist"
      >
        {activeThreadId && (
          <TitleBarTab
            tabKey="chat"
            label={activeThreadTitle ?? "Chat"}
            icon="chat"
            isActive={isChatActive}
            onSelect={() => onSelectContextSurface?.(null)}
          />
        )}
        {fileWindows.map((win) => (
          <TitleBarTab
            key={win.id}
            tabKey={win.id}
            label={getFileName(win.filePath)}
            icon="file"
            isActive={selectedContextSurface === win.id}
            isClosable
            onSelect={() => onSelectContextSurface?.(win.id)}
            onClose={
              onCloseFileWindow ? () => onCloseFileWindow(win.id) : undefined
            }
          />
        ))}
      </div>

      <div
        data-slot="titlebar-controls"
        data-no-drag="true"
        className="flex items-center gap-2"
      >
        <TooltipProvider>
          <GitSplitButton
            onAgentGitAction={onAgentGitAction}
            hasActiveThread={hasActiveThread}
            hasChangesToCommit={hasChangesToCommit}
            hasCommitsToPush={hasCommitsToPush}
            isPromptExecuting={isPromptExecuting}
          />
          {onToggleTerminal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleTerminal}
                  className={cn(
                    "flex size-7 items-center justify-center",
                    "border border-white/[0.06] transition-colors duration-150",
                    isTerminalVisible
                      ? "bg-white/[0.06] text-white/80"
                      : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                  )}
                  aria-label={
                    isTerminalVisible ? "Close terminal" : "Open terminal"
                  }
                >
                  <TerminalWindow className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Terminal</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
