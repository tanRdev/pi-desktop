import type { ThreadRuntimeStatus } from "@pidesk/shared";
import type { AgentLiveFeed } from "@pidesk/shell-model";
import * as React from "react";
import { cn } from "@/lib/utils";
import { RuntimeStatusChip } from "./runtime-status-chip";

function formatActivityLabel(type: AgentLiveFeed["activity"][number]["type"]) {
  switch (type) {
    case "turn_start":
      return "Turn started";
    case "turn_end":
      return "Turn finished";
    case "agent_start":
      return "Agent running";
    case "agent_end":
      return "Agent idle";
    case "message_start":
      return "Message started";
    case "message_update":
      return "Message updated";
    case "message_end":
      return "Message completed";
    case "tool_execution_start":
      return "Tool started";
    case "tool_execution_update":
      return "Tool updated";
    case "tool_execution_end":
      return "Tool finished";
    case "model_changed":
      return "Model changed";
    default:
      return type;
  }
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return "No events yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export interface WorkspaceActivityPanelProps {
  threadTitle: string | null;
  worktreeLabel: string | null;
  displayAgentStatus: string;
  liveFeed: AgentLiveFeed;
  className?: string;
}

export function WorkspaceActivityPanel({
  threadTitle,
  worktreeLabel,
  displayAgentStatus,
  liveFeed,
  className,
}: WorkspaceActivityPanelProps) {
  const tools = React.useMemo(
    () =>
      Object.values(liveFeed.toolsById).sort(
        (left, right) => right.startedAt - left.startedAt,
      ),
    [liveFeed.toolsById],
  );
  const recentActivity = React.useMemo(
    () => [...liveFeed.activity].slice(-12).reverse(),
    [liveFeed.activity],
  );
  const runningTurns = liveFeed.turns.filter(
    (turn) => turn.status === "running",
  ).length;
  const runningTools = tools.filter((tool) => tool.status === "running").length;
  const safeStatus = (displayAgentStatus || "ready") as ThreadRuntimeStatus;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-transparent text-white select-none",
        className,
      )}
    >
      <div className="border-b border-white/[0.04] px-5 py-4 select-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Agent activity
            </p>
            <h2 className="truncate text-base font-medium text-white/80">
              {threadTitle?.trim() || "Thread"}
            </h2>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
              {worktreeLabel ?? "No worktree"}
            </p>
          </div>
          <RuntimeStatusChip status={safeStatus} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Turns", value: liveFeed.turns.length },
              { label: "Running", value: runningTurns },
              { label: "Tools", value: tools.length },
              { label: "Active tools", value: runningTools },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-3"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-white/40">
                  {metric.label}
                </div>
                <div className="mt-2 text-2xl text-white/80">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
                Recent turns
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/20">
                {formatTimestamp(liveFeed.lastEventTimestamp)}
              </span>
            </div>
            {liveFeed.turns.length > 0 ? (
              <div className="space-y-3">
                {[...liveFeed.turns]
                  .slice(-6)
                  .reverse()
                  .map((turn) => (
                    <div
                      key={turn.id}
                      className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-white/50">
                          {turn.id}
                        </span>
                        <RuntimeStatusChip
                          status={turn.status as ThreadRuntimeStatus}
                          className="px-1.5 py-0 text-[9px]"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
                        <span>{turn.messageIds.length} messages</span>
                        <span>{turn.toolCallIds.length} tools</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-4 font-mono text-[11px] text-white/30">
                Activity appears here once the agent starts working.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
              Tool runs
            </h3>
            {tools.length > 0 ? (
              <div className="space-y-3">
                {tools.slice(0, 8).map((tool) => (
                  <div
                    key={tool.toolCallId}
                    className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white/80">
                        {tool.toolName}
                      </span>
                      <RuntimeStatusChip
                        status={tool.status as ThreadRuntimeStatus}
                        className="px-1.5 py-0 text-[9px]"
                      />
                    </div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
                      {tool.turnId ?? "No turn"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-4 font-mono text-[11px] text-white/30">
                No tool calls yet.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-white/40">
              Timeline
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/80">
                        {formatActivityLabel(entry.type)}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white/30">
                        {entry.turnId ?? "global"}
                        {entry.toolCallId ? ` / ${entry.toolCallId}` : ""}
                        {entry.messageId ? ` / ${entry.messageId}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-white/20">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-4 font-mono text-[11px] text-white/30">
                No activity yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
