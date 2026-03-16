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
  backend?: "shell" | "lazygit" | "pi-linked" | "tmux-attach";
  /** Linked Pi thread ID if backend is pi-linked */
  linkedThreadId?: string;
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
  linkedThreadId,
  ownerWindowId,
  className,
}: TerminalWindowContentProps) {
  return (
    <div className={cn("h-full w-full", className)}>
      <Terminal
        id={terminalId}
        cwd={cwd}
        backend={backend}
        linkedThreadId={linkedThreadId}
        ownerWindowId={ownerWindowId ?? `terminal-${terminalId}`}
        className="h-full w-full rounded-none border-0"
      />
    </div>
  );
}
