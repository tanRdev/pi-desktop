import * as React from "react";
import {
  CaretDown,
  FolderPlus,
  GitCommit,
  TerminalWindow,
  Upload,
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

const COMMIT_PROMPT = "Commit all changes with a conventional-commits message";
const COMMIT_AND_PUSH_PROMPT =
  "Commit all changes with a conventional-commits message and push to origin";
const PUSH_PROMPT = "Push current branch to origin";
const FETCH_PROMPT = "Fetch from origin";

export interface TitleBarProps {
  platform: string | null;
  onAgentGitAction?: (prompt: string) => void;
  hasActiveThread?: boolean;
  onToggleTerminal?: () => void;
  isTerminalVisible?: boolean;
  onAddWorkspace?: () => void;
}

interface GitSplitButtonProps {
  onAgentGitAction?: (prompt: string) => void;
  hasActiveThread: boolean;
}

function GitSplitButton({
  onAgentGitAction,
  hasActiveThread,
}: GitSplitButtonProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const disabled = !hasActiveThread || !onAgentGitAction;

  const send = React.useCallback(
    (prompt: string) => {
      if (disabled) return;
      onAgentGitAction?.(prompt);
      setMenuOpen(false);
    },
    [disabled, onAgentGitAction],
  );

  const title = disabled ? "No active thread" : undefined;

  return (
    <div
      className={cn(
        "flex h-7 items-stretch border border-white/[0.06]",
        disabled && "opacity-40",
      )}
    >
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => send(COMMIT_AND_PUSH_PROMPT)}
        className={cn(
          "flex items-center gap-1.5 px-2 text-[10px] uppercase tracking-wider text-white/70 transition-colors duration-150",
          "hover:bg-white/[0.04] hover:text-white/90",
          "disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/70",
          "focus:outline-none focus-visible:outline-none",
        )}
      >
        <GitCommit className="size-3.5" />
        <span>Commit &amp; Push</span>
      </button>
      <div className="w-px bg-white/[0.06]" aria-hidden="true" />
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            title={title}
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
            <GitMenuItem
              icon={GitCommit}
              label="Commit"
              onClick={() => send(COMMIT_PROMPT)}
            />
            <GitMenuItem
              icon={GitCommit}
              label="Commit & Push"
              onClick={() => send(COMMIT_AND_PUSH_PROMPT)}
            />
            <div className="my-1 h-px bg-white/[0.06]" />
            <GitMenuItem
              icon={Upload}
              label="Push"
              onClick={() => send(PUSH_PROMPT)}
            />
            <GitMenuItem
              icon={Upload}
              label="Fetch"
              onClick={() => send(FETCH_PROMPT)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface GitMenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function GitMenuItem({ icon: Icon, label, onClick }: GitMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-white/70 transition-colors duration-150",
        "hover:bg-white/[0.04] hover:text-white/90",
        "focus:outline-none focus-visible:outline-none",
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </button>
  );
}

export function TitleBar({
  platform,
  onAgentGitAction,
  hasActiveThread = false,
  onToggleTerminal,
  isTerminalVisible = false,
  onAddWorkspace,
}: TitleBarProps) {
  const trafficLightInset = getTrafficLightInset(platform);

  return (
    <div
      data-drag-region="true"
      className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/[0.03] px-4 select-none"
      style={{ paddingLeft: trafficLightInset }}
    >
      <div
        data-slot="titlebar-project"
        className="flex min-w-0 items-center gap-3"
      >
        <div data-testid="titlebar-project-name" className="sr-only" />
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
