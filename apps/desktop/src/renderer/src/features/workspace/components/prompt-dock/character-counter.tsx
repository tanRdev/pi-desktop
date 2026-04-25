import { cn } from "@pi-desktop/ui";

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}M`;
  }

  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}K`;
  }

  return String(tokens);
}

export interface CharacterCounterProps {
  tokens: number | null;
  contextWindow: number;
  className?: string;
}

export function CharacterCounter({
  tokens,
  contextWindow,
  className,
}: CharacterCounterProps) {
  const tokensLabel = tokens !== null ? formatTokens(tokens) : "—";
  const contextWindowLabel = formatTokens(contextWindow);

  return (
    <output
      data-testid="prompt-context-counter"
      aria-live="off"
      className={cn(
        "select-none font-[var(--app-font-mono)] text-[11px] text-[var(--color-text-quaternary)]",
        className,
      )}
      aria-label={`Context usage ${tokensLabel} of ${contextWindowLabel}`}
    >
      <span>
        {tokensLabel} / {contextWindowLabel}
      </span>
    </output>
  );
}
