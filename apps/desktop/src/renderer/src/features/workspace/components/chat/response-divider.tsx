import { cn } from "@pi-desktop/ui";
import * as React from "react";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export interface ResponseDividerProps {
  /** Unix ms when the user sent the message. */
  userTimestamp: number;
  /** Unix ms when assistant finished, or null when still streaming. */
  assistantCompletedAt: number | null;
  /** Whether the response is still in-progress. */
  isWorking: boolean;
}

export function ResponseDivider({
  userTimestamp,
  assistantCompletedAt,
  isWorking,
}: ResponseDividerProps) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!isWorking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isWorking]);

  const label = isWorking
    ? "Response · Working…"
    : assistantCompletedAt !== null
      ? `Response · Worked for ${formatDuration(assistantCompletedAt - userTimestamp)}`
      : `Response · Worked for ${formatDuration(now - userTimestamp)}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 pt-1 pb-3 select-none">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <div
        className={cn(
          "font-mono text-[11px] uppercase tracking-wider text-white/50",
          isWorking && "text-white/50",
        )}
      >
        {label}
      </div>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}
