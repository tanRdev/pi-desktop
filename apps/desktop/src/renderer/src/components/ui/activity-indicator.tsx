"use client";

import {
  Brain,
  Cpu,
  Database,
  FileCode,
  Globe,
  type IconProps,
  Lightning,
  MagnifyingGlass,
  Sparkle,
  Wrench,
} from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import type * as React from "react";

export type ActivityType =
  | "tool"
  | "search"
  | "mcp"
  | "skill"
  | "thinking"
  | "code"
  | "web"
  | "database"
  | "generic";

export type ActivityStatus = "pending" | "running" | "complete" | "error";

export interface ActivityIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  type: ActivityType;
  label: string;
  status?: ActivityStatus;
  duration?: string;
  details?: string;
  count?: number;
}

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ComponentType<IconProps>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  tool: {
    icon: Wrench,
    color: "text-amber-400/70",
    bgColor: "bg-amber-400/10",
    label: "Tool",
  },
  search: {
    icon: MagnifyingGlass,
    color: "text-[var(--color-accent)]/70",
    bgColor: "bg-[var(--color-accent)]/10",
    label: "Search",
  },
  mcp: {
    icon: Cpu,
    color: "text-[var(--color-accent)]/70",
    bgColor: "bg-[var(--color-accent)]/10",
    label: "MCP",
  },
  skill: {
    icon: Sparkle,
    color: "text-purple-400/70",
    bgColor: "bg-purple-400/10",
    label: "Skill",
  },
  thinking: {
    icon: Brain,
    color: "text-cyan-400/70",
    bgColor: "bg-cyan-400/10",
    label: "Thinking",
  },
  code: {
    icon: FileCode,
    color: "text-rose-400/70",
    bgColor: "bg-rose-400/10",
    label: "Code",
  },
  web: {
    icon: Globe,
    color: "text-sky-400/70",
    bgColor: "bg-sky-400/10",
    label: "Web",
  },
  database: {
    icon: Database,
    color: "text-orange-400/70",
    bgColor: "bg-orange-400/10",
    label: "Database",
  },
  generic: {
    icon: Lightning,
    color: "text-white/50",
    bgColor: "bg-white/[0.06]",
    label: "Action",
  },
};

const statusConfig: Record<
  ActivityStatus,
  {
    pulse: boolean;
    borderColor: string;
    dotColor: string;
  }
> = {
  pending: {
    pulse: false,
    borderColor: "border-white/[0.04]",
    dotColor: "bg-white/20",
  },
  running: {
    pulse: true,
    borderColor: "border-white/[0.08]",
    dotColor: "bg-[var(--color-accent)]/60",
  },
  complete: {
    pulse: false,
    borderColor: "border-white/[0.04]",
    dotColor: "bg-white/30",
  },
  error: {
    pulse: false,
    borderColor: "border-red-400/20",
    dotColor: "bg-red-400/60",
  },
};

export function ActivityIndicator({
  type,
  label,
  status = "running",
  duration,
  details,
  count,
  className,
  ...props
}: ActivityIndicatorProps) {
  const config = activityConfig[type];
  const statusCfg = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border px-2.5 py-1.5",
        "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        statusCfg.borderColor,
        "bg-white/[0.02] hover:bg-white/[0.06]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center",
          config.bgColor,
        )}
      >
        <Icon className={cn("size-3.5", config.color)} weight="fill" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[11px] font-normal text-white/70">
          {label}
        </span>

        {count !== undefined && count > 0 && (
          <span
            className={cn(
              "flex h-4 min-w-[16px] items-center justify-center px-1",
              "text-[11px] font-normal tabular-nums",
              config.bgColor,
              config.color,
            )}
          >
            {count}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {details && (
          <span className="truncate text-[11px] text-white/40">{details}</span>
        )}

        {duration && (
          <span className="text-[11px] tabular-nums text-white/50">
            {duration}
          </span>
        )}

        <div
          className={cn(
            "size-1.5",
            statusCfg.dotColor,
            statusCfg.pulse && "animate-pulse",
          )}
        />
      </div>
    </div>
  );
}

export interface ActivityGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
}

export function ActivityGroup({
  children,
  title,
  className,
  ...props
}: ActivityGroupProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {title && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-normal uppercase tracking-wider text-white/50">
            {title}
          </span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export interface StreamingIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  message?: string;
  activities?: Array<{
    id: string;
    type: ActivityType;
    label: string;
    status: "pending" | "running" | "complete" | "error";
    details?: string;
  }>;
}

export function StreamingIndicator({
  message = "Pi is responding",
  activities,
  className,
  ...props
}: StreamingIndicatorProps) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      {/* Activities */}
      {activities && activities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activities.map((activity) => (
            <ActivityIndicator
              key={activity.id}
              type={activity.type}
              label={activity.label}
              status="running"
              details={activity.details}
            />
          ))}
        </div>
      )}

      {/* Responding indicator */}
      <div
        className={cn(
          "flex items-center gap-3 border border-white/[0.06]",
          "bg-white/[0.02] px-4 py-3",
        )}
      >
        <div className="relative">
          <div className="size-2 bg-[var(--color-accent)]/60" />
          <div className="absolute inset-0 size-2 animate-ping bg-[var(--color-accent)]/30" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-normal text-white/70">
            {message}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-white/40">Generating</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1 bg-white/30"
                  style={{
                    animation: `shimmer-bounce 1.4s ease-in-out ${i * 0.15}s infinite`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
