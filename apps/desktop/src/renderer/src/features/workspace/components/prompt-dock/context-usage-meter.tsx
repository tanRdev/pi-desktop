import { cn } from "@/lib/utils";

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const v = tokens / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const v = tokens / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return String(tokens);
}

export interface ContextUsageMeterProps {
  tokens: number | null;
  contextWindow: number;
  percent: number;
}

export function ContextUsageMeter({
  tokens,
  contextWindow,
  percent,
}: ContextUsageMeterProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  const barColor =
    clamped >= 95
      ? "var(--color-error)"
      : clamped >= 80
        ? "var(--color-warning)"
        : "var(--color-accent)";

  const tokensLabel = tokens != null ? formatTokens(tokens) : "—";
  const windowLabel = formatTokens(contextWindow);

  return (
    <div
      className="flex items-center gap-2 select-none"
      role="img"
      aria-label={`Context usage ${clamped}%`}
    >
      <div className="relative h-[2px] w-10 bg-white/[0.08]">
        <div
          className={cn(
            "h-full transition-all duration-[var(--duration-fast)]",
          )}
          style={{ width: `${clamped}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="font-mono text-[10px] text-white/40 tabular-nums">
        {tokensLabel} / {windowLabel}
      </span>
    </div>
  );
}
