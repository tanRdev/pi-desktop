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
      <div className="border-b border-white/[0.04] px-5 py-3.5 select-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="truncate text-sm font-medium text-white/90">
              {threadTitle?.trim() || "Thread"}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30">
              <span className="truncate">{worktreeLabel ?? "No worktree"}</span>
              <span>·</span>
              <span>Agent activity</span>
            </div>
          </div>
          <RuntimeStatusChip status={safeStatus} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-7">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-1">
            {[
              { label: "Turns", value: liveFeed.turns.length },
              { label: "Running", value: runningTurns },
              { label: "Tools", value: tools.length },
              { label: "Active tools", value: runningTools },
            ].map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/20">
                  {metric.label}
                </div>
                <div className="text-xl font-medium text-white/70">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/30">
                Recent turns
              </h3>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/20">
                {formatTimestamp(liveFeed.lastEventTimestamp)}
              </span>
            </div>
            {liveFeed.turns.length > 0 ? (
              <div className="space-y-0.5">
                {[...liveFeed.turns]
                  .slice(-5)
                  .reverse()
                  .map((turn) => (
                    <div
                      key={turn.id}
                      className="group flex items-center justify-between gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50 group-hover:text-white/70">
                            {turn.id}
                          </span>
                          <RuntimeStatusChip
                            status={turn.status as ThreadRuntimeStatus}
                            className="px-1 py-0 text-[8px]"
                          />
                        </div>
                        <div className="mt-1 flex gap-2 font-mono text-[9px] uppercase tracking-wider text-white/20">
                          <span>{turn.messageIds.length} msgs</span>
                          <span>{turn.toolCallIds.length} tools</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="px-1 py-2 text-[12px] text-white/25 italic">
                Activity appears here once the agent starts working.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/30">
                Tool runs
              </h3>
            </div>
            {tools.length > 0 ? (
              <div className="space-y-0.5">
                {tools.slice(0, 6).map((tool) => (
                  <div
                    key={tool.toolCallId}
                    className="group flex items-center justify-between gap-3 rounded-md px-1.5 py-2 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12px] text-white/70 group-hover:text-white/90">
                          {tool.toolName}
                        </span>
                        <RuntimeStatusChip
                          status={tool.status as ThreadRuntimeStatus}
                          className="px-1 py-0 text-[8px]"
                        />
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/20">
                        {tool.turnId ?? "No turn"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-1 py-2 text-[12px] text-white/25 italic">
                No tool calls yet.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="px-1">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/30">
                Timeline
              </h3>
            </div>
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-start justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] text-white/60 group-hover:text-white/80">
                        {formatActivityLabel(entry.type)}
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-white/20">
                        {entry.turnId ?? "global"}
                        {entry.toolCallId ? ` / ${entry.toolCallId}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-white/15">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-1 py-2 text-[12px] text-white/25 italic">
                No activity yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
