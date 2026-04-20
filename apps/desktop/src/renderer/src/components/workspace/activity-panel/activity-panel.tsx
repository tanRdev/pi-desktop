import { Funnel, X } from "@phosphor-icons/react";
import type { LogEntry, LogLevel } from "@pi-desktop/shared";
import { LOG_LEVELS } from "@pi-desktop/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ICON_SIZE_MD, ICON_SIZE_SM } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { type ActivityLogStream, useActivityLog } from "./activity-log-stream";

export interface ActivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stream?: ActivityLogStream;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: "text-gray-400",
  debug: "text-blue-400",
  info: "text-cyan-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  trace: "bg-gray-400/10",
  debug: "bg-blue-400/10",
  info: "bg-cyan-400/10",
  warn: "bg-amber-400/10",
  error: "bg-red-400/10",
};

const LEVEL_BORDER: Record<LogLevel, string> = {
  trace: "border-gray-400/20",
  debug: "border-blue-400/20",
  info: "border-cyan-400/20",
  warn: "border-amber-400/20",
  error: "border-red-400/20",
};

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LevelBadge({ level }: { level: LogLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[2px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider border",
        LEVEL_COLORS[level],
        LEVEL_BG[level],
        LEVEL_BORDER[level],
      )}
    >
      {level}
    </span>
  );
}

function EntryRow({ entry, now }: { entry: LogEntry; now: number }) {
  return (
    <div
      data-testid={`activity-entry-${entry.ts}-${entry.level}`}
      className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 w-full">
          <LevelBadge level={entry.level} />
          <span className="text-[10px] text-white/30 font-mono truncate">
            {entry.scope}
          </span>
        </div>
        <span className="text-[12px] text-[var(--color-text-primary)] leading-snug break-words">
          {entry.message}
        </span>
      </div>
      <span className="text-[10px] text-white/25 shrink-0 mt-0.5">
        {formatRelative(entry.ts, now)}
      </span>
    </div>
  );
}

type LevelFilter = LogLevel | "all";

function FilterBar({
  levelFilter,
  onLevelFilterChange,
  scopeFilter,
  onScopeFilterChange,
}: {
  levelFilter: LevelFilter;
  onLevelFilterChange: (level: LevelFilter) => void;
  scopeFilter: string;
  onScopeFilterChange: (scope: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
      <Funnel className={cn(ICON_SIZE_SM, "text-white/30 shrink-0")} />
      <div className="flex items-center gap-1 flex-wrap">
        {(["all", ...LOG_LEVELS] as const).map((level) => (
          <button
            key={level}
            type="button"
            data-testid={`activity-filter-level-${level}`}
            onClick={() => onLevelFilterChange(level)}
            className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-[2px] border transition-colors uppercase tracking-wider",
              levelFilter === level
                ? cn(
                    LEVEL_COLORS[level === "all" ? "info" : level],
                    LEVEL_BG[level === "all" ? "info" : level],
                    LEVEL_BORDER[level === "all" ? "info" : level],
                    "font-semibold",
                  )
                : "text-white/30 border-white/[0.06] hover:text-white/50 hover:border-white/[0.12]",
            )}
          >
            {level}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Filter scope..."
        value={scopeFilter}
        onChange={(e) => onScopeFilterChange(e.target.value)}
        className="ml-auto text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-[2px] px-2 py-1 text-[var(--color-text-primary)] placeholder:text-white/20 focus:outline-none focus:border-white/[0.12] w-28"
        data-testid="activity-filter-scope"
      />
    </div>
  );
}

export function ActivityPanel({
  open,
  onOpenChange,
  stream,
}: ActivityPanelProps) {
  const log = useActivityLog(stream);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [scopeFilter, setScopeFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScroll = useRef(true);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setLevelFilter("all");
    setScopeFilter("");
  }, [open]);

  const filteredEntries = useCallback(() => {
    let result = log.entries;
    if (levelFilter !== "all") {
      result = result.filter((e) => e.level === levelFilter);
    }
    if (scopeFilter) {
      const lower = scopeFilter.toLowerCase();
      result = result.filter((e) => e.scope.toLowerCase().includes(lower));
    }
    return result;
  }, [log.entries, levelFilter, scopeFilter])();

  const filteredLen = filteredEntries.length;
  useEffect(() => {
    if (!isAutoScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    void filteredLen;
  });

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    isAutoScroll.current = atBottom;
  }, []);

  if (!open) return null;

  const now = Date.now();

  return (
    <>
      <button
        type="button"
        aria-label="Close activity panel"
        data-testid="activity-backdrop"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-40 bg-transparent cursor-default"
      />
      <aside
        role="dialog"
        aria-label="Activity log"
        data-testid="activity-drawer"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-[440px] flex-col",
          "bg-[var(--color-bg-secondary)] border-l border-white/[0.06]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          "motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-200",
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Activity className={cn(ICON_SIZE_MD, "text-white/50")} />
            <span className="text-[11px] tracking-wide text-white/70 uppercase">
              Activity
            </span>
            <span className="text-[10px] text-white/30">
              {filteredEntries.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {log.entries.length > 0 ? (
              <button
                type="button"
                data-testid="activity-clear"
                onClick={log.clear}
                className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-2 py-1"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              data-testid="activity-close"
              onClick={() => onOpenChange(false)}
              className="flex size-6 items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <FilterBar
          levelFilter={levelFilter}
          onLevelFilterChange={setLevelFilter}
          scopeFilter={scopeFilter}
          onScopeFilterChange={setScopeFilter}
        />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="activity-scroll-container"
          className="flex-1 overflow-y-auto"
        >
          {filteredEntries.length === 0 ? (
            <div
              data-testid="activity-empty"
              className="flex h-full items-center justify-center px-6 text-center"
            >
              <p className="text-[11px] text-white/30">No activity yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredEntries.map((entry, i) => (
                <EntryRow
                  key={`${entry.ts}-${entry.level}-${i}`}
                  entry={entry}
                  now={now}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
