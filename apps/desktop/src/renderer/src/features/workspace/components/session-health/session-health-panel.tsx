import { Heart, Warning, WifiHigh, WifiSlash } from "@phosphor-icons/react";
import { ICON_SIZE_MD, ICON_SIZE_SM } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type {
  ConnectionStatus,
  SessionHealthSnapshot,
} from "./use-session-health";

export interface SessionHealthPanelProps {
  readonly snapshot: SessionHealthSnapshot;
}

const CONNECTION_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  connected: {
    label: "Connected",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    dot: "bg-emerald-400",
  },
  reconnecting: {
    label: "Reconnecting",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    dot: "bg-amber-400",
  },
  offline: {
    label: "Offline",
    color: "text-red-400",
    bg: "bg-red-400/10",
    dot: "bg-red-400",
  },
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatBytes(mb: number): string {
  if (mb < 1) return `${(mb * 1024).toFixed(0)}KB`;
  if (mb < 1024) return `${mb.toFixed(1)}MB`;
  return `${(mb / 1024).toFixed(2)}GB`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ConnectionIcon({ status }: { status: ConnectionStatus }) {
  if (status === "offline") {
    return (
      <WifiSlash
        className={cn(ICON_SIZE_SM, CONNECTION_CONFIG[status].color)}
      />
    );
  }
  return (
    <WifiHigh className={cn(ICON_SIZE_SM, CONNECTION_CONFIG[status].color)} />
  );
}

function MetricCard({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2.5",
        "bg-[var(--color-bg-tertiary)] border border-white/[0.04]",
      )}
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5">
        {icon ? (
          <span className={cn(ICON_SIZE_SM, "text-white/30")}>{icon}</span>
        ) : null}
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-[11px] font-mono tabular-nums text-white/80">
        {value}
      </span>
    </div>
  );
}

export function SessionHealthPanel({ snapshot }: SessionHealthPanelProps) {
  const conn = CONNECTION_CONFIG[snapshot.connectionStatus];

  return (
    <div data-testid="session-health-panel" className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 px-1">
        <Heart className={cn(ICON_SIZE_MD, "text-white/50")} />
        <span className="text-[11px] tracking-wide text-white/70 uppercase">
          Session Health
        </span>
      </div>

      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[2px] px-2 py-0.5 border self-start",
          conn.color,
          conn.bg,
          snapshot.connectionStatus === "connected"
            ? "border-emerald-400/20"
            : snapshot.connectionStatus === "reconnecting"
              ? "border-amber-400/20"
              : "border-red-400/20",
        )}
        data-testid="session-health-connection"
      >
        <ConnectionIcon status={snapshot.connectionStatus} />
        <span className={cn("block size-1.5 rounded-full", conn.dot)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {conn.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {snapshot.memory !== null ? (
          <MetricCard
            label="Memory"
            value={formatBytes(snapshot.memory.usedJsHeapMb)}
            icon={<Heart className="size-3.5" />}
            testId="session-health-memory"
          />
        ) : null}

        <MetricCard
          label="Duration"
          value={formatDuration(snapshot.durationMs)}
          testId="session-health-duration"
        />

        <MetricCard
          label="Events"
          value={String(snapshot.eventCount)}
          testId="session-health-events"
        />

        <MetricCard
          label="Error Rate"
          value={formatPercent(snapshot.errorRate)}
          icon={
            <Warning
              className={cn(
                ICON_SIZE_SM,
                snapshot.errorRate > 0 ? "text-red-400" : "text-white/30",
              )}
            />
          }
          testId="session-health-error-rate"
        />
      </div>
    </div>
  );
}
