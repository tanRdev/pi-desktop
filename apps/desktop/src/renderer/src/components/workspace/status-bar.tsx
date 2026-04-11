// TODO: StatusBar is currently unused — re-enable in workspace-shell.tsx when ready
import { GitBranch, ICON_SIZE_XS } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import desktopPackage from "../../../../../package.json";

const appVersion = `Pi v${desktopPackage.version}`;

export interface StatusBarProps {
  activeWorktreeLabel: string | null;
  className?: string;
}

export function StatusBar({ activeWorktreeLabel, className }: StatusBarProps) {
  return (
    <footer
      aria-hidden="true"
      className={cn(
        "z-20 flex h-5 shrink-0 select-none items-center justify-between border-t border-white/[0.03] bg-[var(--color-bg-secondary)] px-3",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <div className="group flex items-center gap-1.5 transition-colors">
          <GitBranch
            className={`${ICON_SIZE_XS} text-white/25 group-hover:text-white/50 transition-colors`}
          />
          <span className="font-mono text-[14px] font-medium uppercase tracking-[0.08em] text-white/25 group-hover:text-white/50 transition-colors">
            {activeWorktreeLabel ?? "no-branch"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-white/20"></div>
        <span className="font-mono text-[14px] font-normal text-white/20 tracking-tight">
          {appVersion}
        </span>
      </div>
    </footer>
  );
}
