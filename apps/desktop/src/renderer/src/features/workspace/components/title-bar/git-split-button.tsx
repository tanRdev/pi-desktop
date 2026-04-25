import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { CaretDown, GitCommit, Upload } from "@/components/ui/phosphor-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

export interface GitSplitButtonProps {
  onAgentGitAction?: (prompt: string) => void;
  hasActiveThread: boolean;
  hasChangesToCommit: boolean;
  hasCommitsToPush: boolean;
  isPromptExecuting: boolean;
}

export function GitSplitButton({
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
    GIT_ACTIONS.find((action) => action.id === selectedAction) ??
    GIT_ACTIONS[0];
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
          "flex items-center gap-1.5 px-2 text-[11px] uppercase tracking-wider transition-colors duration-150",
          showGlow
            ? "text-green-400 hover:bg-green-500/10 hover:text-green-300"
            : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
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
              "hover:bg-white/[0.06] hover:text-white/90",
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
                    "flex items-center gap-2 px-2 py-1.5 text-left text-[11px] uppercase tracking-wider transition-colors duration-150",
                    action.id === selectedAction
                      ? "text-white/90 bg-white/[0.06]"
                      : "text-white/70 hover:bg-white/[0.06] hover:text-white/90",
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
