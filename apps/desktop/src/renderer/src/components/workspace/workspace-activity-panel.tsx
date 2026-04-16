import type { ThreadRuntimeStatus } from "@pi-desktop/shared";
import type { AgentLiveFeed } from "@pi-desktop/shell-model";
import { Skeleton } from "boneyard-js/react";
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
  isLoading?: boolean;
  className?: string;
}

function ActivityPanelSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent text-white select-none">
      <div className="border-b border-white/[0.04] px-5 py-3 select-none">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-0.5">
            <div className="h-4 w-24 bg-white/5" />
            <div className="h-3 w-16 bg-white/5" />
          </div>
          <div className="h-5 w-16 rounded-full bg-white/5" />
        </div>
      </div>
      <div className="min-h-0 flex-1 px-5 py-4">
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-4 px-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-0.5">
                <div className="h-3 w-12 bg-white/5" />
                <div className="h-4 w-8 bg-white/5" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="h-3 w-16 bg-white/5" />
              <div className="h-3 w-12 bg-white/5" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 px-1.5"
              >
                <div className="min-w-0">
                  <div className="h-3 w-28 bg-white/5" />
                </div>
                <div className="h-3 w-10 bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceActivityPanel({
  threadTitle,
  worktreeLabel,
  displayAgentStatus,
  liveFeed,
  isLoading = false,
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
    () => [...liveFeed.activity].slice(-15).reverse(),
    [liveFeed.activity],
  );
  const runningTurns = liveFeed.turns.filter(
    (turn) => turn.status === "running",
  ).length;
  const runningTools = tools.filter((tool) => tool.status === "running").length;
  const safeStatus = (displayAgentStatus || "ready") as ThreadRuntimeStatus;

  return (
    <Skeleton
      name="activity-panel"
      loading={isLoading}
      fixture={<ActivityPanelSkeleton />}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col bg-transparent text-white select-none",
          className,
        )}
      >
        <div className="border-b border-white/[0.04] px-5 py-3 select-none">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <h2 className="truncate text-[10.5px] font-normal text-white/90">
                {threadTitle?.trim() || "Thread"}
              </h2>
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-white/30">
                <span className="truncate">
                  {worktreeLabel ?? "No worktree"}
                </span>
                <span>·</span>
                <span>Activity</span>
              </div>
            </div>
            <RuntimeStatusChip status={safeStatus} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4 px-1">
              {[
                { label: "Turns", value: liveFeed.turns.length },
                { label: "Running", value: runningTurns },
                { label: "Tools", value: tools.length },
                { label: "Active", value: runningTools },
              ].map((metric) => (
                <div key={metric.label} className="space-y-0.5">
                  <div className="text-[10.5px] font-normal uppercase tracking-wider text-white/15">
                    {metric.label}
                  </div>
                  <div className="text-[10.5px] font-normal text-white/60 tabular-nums">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10.5px] font-normal uppercase tracking-wider text-white/30">
                  Timeline
                </h3>
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-white/15">
                  {formatTimestamp(liveFeed.lastEventTimestamp)}
                </span>
              </div>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((entry) => {
                    const isRunning =
                      entry.type.includes("start") ||
                      entry.type.includes("update");
                    return (
                      <div
                        key={entry.id}
                        className="group flex items-start justify-between gap-3 px-1.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "size-1.5 rounded-full",
                                isRunning ? "bg-[#00E559]/50" : "bg-white/10",
                              )}
                            />
                            <div className="truncate text-[10.5px] text-white/50 group-hover:text-white/80">
                              {formatActivityLabel(entry.type)}
                            </div>
                          </div>
                          <div className="ml-3.5 mt-0.5 font-mono text-[10.5px] uppercase tracking-wider text-white/15">
                            {entry.turnId ?? "global"}
                            {entry.toolCallId ? ` / ${entry.toolCallId}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-white/10">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-1 py-2 text-[10.5px] text-white/25 italic">
                  No activity yet.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
