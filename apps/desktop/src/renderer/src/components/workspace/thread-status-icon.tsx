import type { ThreadRuntimeStatus } from "@pidesk/shared";
import { cn } from "@/lib/utils";
import { useUnicodeSpinner } from "@/hooks/use-unicode-spinner";

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

function WorkingSpinner({ className }: { className?: string }) {
  const frame = useUnicodeSpinner("braille", true);
  return (
    <span
      role="img"
      className={cn("text-violet-400/80 font-mono leading-none", className)}
      aria-label="Agent working"
    >
      {frame}
    </span>
  );
}

export function ThreadStatusIcon({
  displayStatus,
  className,
}: ThreadStatusIconProps) {
  switch (displayStatus) {
    case "working":
      return <WorkingSpinner className={className} />;
    case "archived":
    case "idle":
      return (
        <span
          role="img"
          className={cn(
            "inline-block size-1.5 rounded-full bg-white/15",
            className,
          )}
          aria-label={displayStatus === "archived" ? "Archived" : "Idle"}
        />
      );
  }
}
