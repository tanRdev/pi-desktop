import { PromptInputAction } from "@pi-desktop/ui";

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  }
  return String(tokens);
}

export function getContextPercentage(
  tokens: number,
  contextWindow: number,
): number {
  if (contextWindow <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((tokens / contextWindow) * 100));
}

export interface ContextGaugeProps {
  tokens: number | null;
  contextWindow: number;
  percent: number;
  modelDisplayName: string;
}

export function ContextGauge({
  tokens,
  contextWindow,
  percent,
  modelDisplayName,
}: ContextGaugeProps) {
  const circumference = 2 * Math.PI * 10;
  const dashOffset = circumference * (1 - percent / 100);

  return (
    <PromptInputAction
      tooltip={
        <div className="flex flex-col gap-1 px-1 py-0.5">
          <div className="text-[11px] font-normal text-white">
            {modelDisplayName}
          </div>
          <div className="text-[11px] text-white/50">
            Context: {formatTokenCount(tokens ?? 0)} /{" "}
            {formatTokenCount(contextWindow)} tokens
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-1.5 cursor-default">
        <div className="relative flex items-center justify-center size-4">
          <svg
            className="size-full -rotate-90 transform"
            viewBox="0 0 24 24"
            aria-label={`Context window usage ${percent}%`}
            role="img"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3.5"
              fill="transparent"
              className="text-white/10"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="text-[var(--color-text-tertiary)] transition-all duration-500 ease-in-out"
            />
          </svg>
        </div>
        <span className="tabular-nums text-[11px] font-light text-[var(--color-text-tertiary)]">
          {percent}%
        </span>
      </div>
    </PromptInputAction>
  );
}
