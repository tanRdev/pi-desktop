import { cn } from "@/lib/utils";

export interface CharacterCounterProps {
  value: string;
  /** Optional token count when a tokenizer is available. */
  tokenCount?: number | null;
  className?: string;
}

/**
 * Compact character (and optional token) counter for the prompt dock.
 */
export function CharacterCounter({
  value,
  tokenCount,
  className,
}: CharacterCounterProps) {
  const charCount = value.length;
  const showTokens = typeof tokenCount === "number" && tokenCount >= 0;

  return (
    <output
      data-testid="prompt-char-counter"
      aria-live="off"
      className={cn(
        "select-none font-[var(--app-font-mono)] text-[10px] text-[var(--color-text-quaternary)]",
        className,
      )}
      aria-label={
        showTokens
          ? `${charCount} characters, ${tokenCount} tokens`
          : `${charCount} characters`
      }
    >
      <span>{charCount} ch</span>
      {showTokens ? <span className="ml-1">· {tokenCount} tok</span> : null}
    </output>
  );
}
