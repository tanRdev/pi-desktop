import type { ThreadRuntimeStatus } from "@pidesk/shared";
import { cn } from "@/lib/utils";

export type ThreadDisplayStatus = "working" | "idle" | "archived";

export function deriveThreadDisplayStatus(
  runtimeStatus: ThreadRuntimeStatus,
  isArchived: boolean,
): ThreadDisplayStatus {
  if (isArchived) return "archived";
  if (runtimeStatus === "streaming" || runtimeStatus === "starting")
    return "working";
  return "idle";
}

interface ThreadStatusIconProps {
  displayStatus: ThreadDisplayStatus;
  className?: string;
}

export function ThreadStatusIcon({
  displayStatus,
  className,
}: ThreadStatusIconProps) {
  switch (displayStatus) {
    case "working":
      return (
        <span
          role="img"
          className={cn(
            "unicode-thinking inline-flex items-center justify-center text-[13px] leading-none text-violet-400 font-mono",
            className,
          )}
          aria-label="Agent working"
        />
      );
    case "archived":
      return (
        <span
          role="img"
          className={cn(
            "inline-block size-1.5 rounded-full bg-white/15",
            className,
          )}
          aria-label="Archived"
        />
      );
    case "idle":
      return (
        <span
          role="img"
          className={cn(
            "inline-block size-1.5 rounded-full bg-white/15",
            className,
          )}
          aria-label="Idle"
        />
      );
  }
}
