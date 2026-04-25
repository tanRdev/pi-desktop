import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Tool, type ToolPart } from "@/components/ui/tool";

type ToolState = "input-streaming" | "output-available" | "output-error";

function toolStateFromMessage(m: AgentMessageSnapshot): ToolState {
  switch (m.status) {
    case "error":
      return "output-error";
    case "streaming":
      return "input-streaming";
    default:
      return "output-available";
  }
}

function buildToolPart(message: AgentMessageSnapshot): ToolPart {
  const toolNameMatch = /^tool:([^:]+):/.exec(message.id);
  const hasContent = message.text && message.text.trim().length > 0;
  return {
    type: toolNameMatch?.[1] ?? "workspace.tool",
    state: toolStateFromMessage(message),
    output: hasContent ? { transcript: message.text } : undefined,
    errorText: message.status === "error" ? message.text : undefined,
  };
}

export interface ToolCallRollupProps {
  tools: AgentMessageSnapshot[];
  /** Stable key (e.g. user message id that started the turn). */
  turnId: string;
  /** How many to show before collapsing (default 3). */
  initialVisible?: number;
}

export function ToolCallRollup({
  tools,
  initialVisible = 3,
}: ToolCallRollupProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (tools.length === 0) return null;

  const visibleCount =
    expanded || tools.length <= initialVisible ? tools.length : initialVisible;
  const hiddenCount = tools.length - visibleCount;

  return (
    <div className="w-full space-y-0">
      {tools.slice(0, visibleCount).map((t) => (
        <Tool
          key={t.id}
          toolPart={buildToolPart(t)}
          defaultOpen={t.status !== "complete"}
        />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={cn(
            "w-full text-left px-0 py-2 font-mono text-[11px] uppercase tracking-wider",
            "text-white/50 hover:text-white/70",
            "transition-colors duration-[var(--duration-fast)]",
          )}
        >
          + {hiddenCount} more tool {hiddenCount === 1 ? "call" : "calls"}
        </button>
      )}
    </div>
  );
}
