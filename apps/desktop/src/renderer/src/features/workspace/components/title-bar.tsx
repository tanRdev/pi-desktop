import { TerminalWindow } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ContextSurfaceKey,
  ContextWindow,
} from "@/features/workspace/workspace-pane-state";
import { getTrafficLightInset } from "@/lib/title-bar-layout";
import { cn } from "@/lib/utils";
import { GitSplitButton } from "./title-bar/git-split-button";
import { TitleBarTabs } from "./title-bar/title-bar-tabs";

const EMPTY_CONTEXT_WINDOWS: ContextWindow[] = [];

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
  contextWindows = EMPTY_CONTEXT_WINDOWS,
  selectedContextSurface,
  onSelectContextSurface,
  onCloseFileWindow,
}: TitleBarProps) {
  const trafficLightInset = getTrafficLightInset(platform);

  return (
    <div
      data-drag-region="true"
      className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/[0.03] px-4 select-none"
      style={{ paddingLeft: trafficLightInset }}
    >
      <TitleBarTabs
        activeThreadId={activeThreadId}
        activeThreadTitle={activeThreadTitle}
        contextWindows={contextWindows}
        selectedContextSurface={selectedContextSurface}
        onSelectContextSurface={onSelectContextSurface}
        onCloseFileWindow={onCloseFileWindow}
      />

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
