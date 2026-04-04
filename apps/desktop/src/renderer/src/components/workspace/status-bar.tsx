import { cn } from "@/lib/utils";
import { GitBranch, ICON_SIZE_XS } from "@/components/ui/icons";
import desktopPackage from "../../../../../package.json";

const appVersion = `PiDesk v${desktopPackage.version}`;

export interface StatusBarProps {
  activeWorktreeLabel: string | null;
  className?: string;
}

export function StatusBar({ activeWorktreeLabel, className }: StatusBarProps) {
  return (
    <footer
      aria-hidden="true"
      className={cn(
        "z-20 flex h-7 shrink-0 select-none items-center justify-between border-t border-[#474747]/20 bg-[#0d0d0d] px-4",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <div className="group flex items-center gap-1.5">
          <GitBranch className={`${ICON_SIZE_XS} text-white`} />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#474747] group-hover:text-white">
            {activeWorktreeLabel ?? "no-branch"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 bg-white"></div>
        <span className="font-mono text-[10px] font-bold text-white tracking-tight">
          {appVersion}
        </span>
      </div>
    </footer>
  );
}
