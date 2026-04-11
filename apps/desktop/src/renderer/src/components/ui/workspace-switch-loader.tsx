import { Pi } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface WorkspaceSwitchLoaderProps {
  repositoryName: string | null;
}

export function WorkspaceSwitchLoader({
  repositoryName,
}: WorkspaceSwitchLoaderProps) {
  return (
    <div
      data-testid="workspace-switch-loader"
      className={cn(
        "absolute inset-0 z-[100] flex items-center justify-center",
        "bg-[#050505] text-white",
      )}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <Pi className="size-16 motion-safe:animate-[pulse_1100ms_ease-in-out_infinite]" />
        <div className="space-y-1">
          <p className="text-[14px] uppercase tracking-[0.28em] text-white/45">
            Switching workspace
          </p>
          <p className="text-sm text-white/72">
            {repositoryName && repositoryName.trim().length > 0
              ? `Opening ${repositoryName}`
              : "Opening project"}
          </p>
        </div>
      </div>
    </div>
  );
}
