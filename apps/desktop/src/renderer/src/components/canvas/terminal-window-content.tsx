/**
 * Terminal window content - renders a terminal in a window.
 */

import { cn } from "@/lib/utils";
import { Terminal } from "../ui/terminal";

/**
 * Props for TerminalWindowContent component.
 */
export interface TerminalWindowContentProps {
  /** Terminal session ID */
  terminalId: string;
  /** Working directory */
  cwd: string;
  /** Terminal backend mode */
  backend?: "shell" | "lazygit";
  /** Owning window ID */
  ownerWindowId?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Terminal window content component.
 */
export function TerminalWindowContent({
  terminalId,
  cwd,
  backend = "shell",
  ownerWindowId,
  className,
}: TerminalWindowContentProps) {
  return (
    <div
      className={cn(
        "h-full w-full",
        // Window enter animation - scale from 0.95 with translateY
        "animate-[window-enter_300ms_cubic-bezier(0.23,1,0.32,1)_forwards]",
        className,
      )}
    >
      <Terminal
        id={terminalId}
        cwd={cwd}
        backend={backend}
        ownerWindowId={ownerWindowId ?? `terminal-${terminalId}`}
        className="h-full w-full rounded-none border-0"
      />
    </div>
  );
}
