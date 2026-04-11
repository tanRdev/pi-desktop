import type { ThreadRuntimeStatus } from "@pidesk/shared";
import { useUnicodeSpinner } from "@/hooks/use-unicode-spinner";
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
  const braille = useUnicodeSpinner("diagswipe", displayStatus === "working");

  switch (displayStatus) {
    case "working":
      return (
        <span
          role="img"
          className={cn(
            "inline-flex items-center justify-center text-[12px] leading-none text-white font-mono whitespace-nowrap",
            className,
          )}
          aria-label="Agent working"
        >
          {braille}
        </span>
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
