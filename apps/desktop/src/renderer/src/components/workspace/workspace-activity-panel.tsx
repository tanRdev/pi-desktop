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
  runtimeModeLabel: string;
  displayAgentStatus: string;
  liveFeed: AgentLiveFeed;
  className?: string;
}

export function WorkspaceActivityPanel({
  threadTitle,
  worktreeLabel,
  runtimeModeLabel,
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
        "flex h-full min-h-0 flex-col bg-[#0d0d0d] text-white",
        className,
      )}
    >
      <div className="border-b border-[#474747]/18 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#6f6f6f]">
              Agent activity
            </p>
            <h2 className="truncate text-sm font-medium text-white">
              {threadTitle?.trim() || "Current thread"}
            </h2>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#8a8a8a]">
              {worktreeLabel ?? "No worktree"} / {runtimeModeLabel}
            </p>
          </div>
          <RuntimeStatusChip status={safeStatus} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Turns", value: liveFeed.turns.length },
              { label: "Running", value: runningTurns },
              { label: "Tools", value: tools.length },
              { label: "Active tools", value: runningTools },
            ].map((metric) => (
              <div
                key={metric.label}
                className="border border-[#474747]/16 bg-[#111111] px-3 py-2"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">
                  {metric.label}
                </div>
                <div className="mt-1 text-lg text-white">{metric.value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">
                Recent turns
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#555]">
                {formatTimestamp(liveFeed.lastEventTimestamp)}
              </span>
            </div>
            {liveFeed.turns.length > 0 ? (
              <div className="space-y-2">
                {[...liveFeed.turns]
                  .slice(-6)
                  .reverse()
                  .map((turn) => (
                    <div
                      key={turn.id}
                      className="border border-[#474747]/16 bg-[#111111] px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8f8f8f]">
                          {turn.id}
                        </span>
                        <RuntimeStatusChip
                          status={turn.status as ThreadRuntimeStatus}
                          className="px-1.5 py-0 text-[9px]"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">
                        <span>{turn.messageIds.length} messages</span>
                        <span>{turn.toolCallIds.length} tools</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="border border-[#474747]/16 bg-[#111111] px-3 py-4 font-mono text-[11px] text-[#777]">
                The activity pane will fill with planning, tool calls, and
                progress as soon as the agent starts working.
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">
              Tool runs
            </h3>
            {tools.length > 0 ? (
              <div className="space-y-2">
                {tools.slice(0, 8).map((tool) => (
                  <div
                    key={tool.toolCallId}
                    className="border border-[#474747]/16 bg-[#111111] px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-white">
                        {tool.toolName}
                      </span>
                      <RuntimeStatusChip
                        status={tool.status as ThreadRuntimeStatus}
                        className="px-1.5 py-0 text-[9px]"
                      />
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">
                      {tool.turnId ?? "No turn"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#474747]/16 bg-[#111111] px-3 py-4 font-mono text-[11px] text-[#777]">
                No tool calls yet.
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f6f6f]">
              Timeline
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 border border-[#474747]/16 bg-[#111111] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {formatActivityLabel(entry.type)}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#666]">
                        {entry.turnId ?? "global"}
                        {entry.toolCallId ? ` / ${entry.toolCallId}` : ""}
                        {entry.messageId ? ` / ${entry.messageId}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-[#555]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#474747]/16 bg-[#111111] px-3 py-4 font-mono text-[11px] text-[#777]">
                No activity yet.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
