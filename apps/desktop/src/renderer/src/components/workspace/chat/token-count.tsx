import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TokenCountProps {
  tokens?: number | null;
  className?: string;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(2)}k`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/**
 * Token count pill for assistant messages. Renders nothing when tokens
 * are missing — caller-side metadata is optional.
 */
export function TokenCount({ tokens, className }: TokenCountProps) {
  if (tokens === undefined || tokens === null) return null;
  if (!Number.isFinite(tokens) || tokens < 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="token-count"
          className={cn(
            "inline-flex items-center font-mono text-[10px] uppercase tracking-wider text-white/30 select-none",
            className,
          )}
        >
          {formatTokens(tokens)} tok
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tokens} tokens</TooltipContent>
    </Tooltip>
  );
}
