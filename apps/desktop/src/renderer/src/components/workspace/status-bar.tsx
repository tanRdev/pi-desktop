import { GitBranch, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusBarProps {
  activeWorktreeLabel: string | null;
  className?: string;
}

export function StatusBar({ activeWorktreeLabel, className }: StatusBarProps) {
  return (
    <footer
      className={cn(
        "fixed bottom-0 left-0 w-full h-6 bg-[#0e0e0e] border-t border-[#474747]/20 flex items-center justify-between px-3 z-50",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 group cursor-pointer">
          <GitBranch className="size-3 text-white" />
          <span className="text-[9px] font-medium text-[#474747] group-hover:text-white uppercase font-mono">
            {activeWorktreeLabel ?? "no-branch"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 group cursor-pointer">
          <RefreshCcw className="size-3 text-white" />
          <span className="text-[9px] font-medium text-[#474747] group-hover:text-white uppercase font-mono">
            Syncing...
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[9px] text-[#474747] uppercase font-mono">
          Line 143, Col 12
        </span>
        <span className="text-[9px] text-[#474747] uppercase font-mono">
          UTF-8
        </span>
        <span className="text-[9px] text-[#474747] uppercase font-mono">
          Rust (Pi-Harness)
        </span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-white"></div>
          <span className="text-[9px] font-bold text-white uppercase font-mono">
            Operator_01
          </span>
        </div>
      </div>
    </footer>
  );
}
