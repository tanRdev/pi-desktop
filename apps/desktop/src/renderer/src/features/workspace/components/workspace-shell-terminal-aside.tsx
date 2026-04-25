import { cn } from "@pi-desktop/ui";
import { X } from "@/components/ui/phosphor-icons";
import { Terminal } from "@/components/ui/terminal";

export interface WorkspaceShellTerminalAsideProps {
  workspacePath: string | null;
  onToggleTerminal: () => void;
  onTerminalCommandComplete: () => void;
}

function WorkspaceShellTerminalAsideImpl({
  workspacePath,
  onToggleTerminal,
  onTerminalCommandComplete,
}: WorkspaceShellTerminalAsideProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[420px] shrink-0 flex-col border-l border-white/[0.06] bg-[var(--color-bg-primary)]",
        "animate-in slide-in-from-right duration-[var(--duration-normal)] [transition-timing-function:var(--ease-emphasized-decel)]",
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
          Terminal
        </span>
        <button
          type="button"
          onClick={onToggleTerminal}
          className="flex size-6 items-center justify-center text-white/50 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white/70"
          aria-label="Close terminal"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <Terminal
          id="sidebar-terminal"
          cwd={workspacePath ?? undefined}
          onCommandComplete={onTerminalCommandComplete}
        />
      </div>
    </aside>
  );
}

export const WorkspaceShellTerminalAside = WorkspaceShellTerminalAsideImpl;
