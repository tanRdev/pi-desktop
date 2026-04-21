import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface MessageTimestampProps {
  /** Unix ms */
  timestamp: number;
  className?: string;
  /** Re-render cadence (ms). Default 30s. */
  tickMs?: number;
}

function formatRelative(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const sec = Math.floor(abs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

function formatIso(timestamp: number): string {
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return String(timestamp);
  }
}

/**
 * Message timestamp — relative label with full ISO in tooltip.
 * Uses a lightweight interval so "2m ago" updates without re-rendering
 * the entire message.
 */
export function MessageTimestamp({
  timestamp,
  className,
  tickMs = 30000,
}: MessageTimestampProps) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  const relative = formatRelative(now - timestamp);
  const iso = formatIso(timestamp);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time
          dateTime={iso}
          data-testid="message-timestamp"
          className={cn(
            "font-mono text-[10px] text-white/30 select-none",
            className,
          )}
        >
          {relative}
        </time>
      </TooltipTrigger>
      <TooltipContent side="top">{iso}</TooltipContent>
    </Tooltip>
  );
}
