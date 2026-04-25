import { X } from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import { useEffect } from "react";
import {
  globalNotificationCenter,
  type Notification,
  type NotificationCenter,
  type NotificationLevel,
} from "./notification-center";
import { useNotifications } from "./use-notifications";

export interface NotificationListProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center?: NotificationCenter;
}

const LEVEL_DOT_COLOR: Record<NotificationLevel, string> = {
  success: "var(--color-success)",
  info: "var(--color-info)",
  warn: "var(--color-warning)",
  error: "var(--color-error)",
};

const LEVEL_LABEL: Record<NotificationLevel, string> = {
  success: "Success",
  info: "Info",
  warn: "Warning",
  error: "Error",
};

function formatRelative(createdAt: number, now: number): string {
  const diff = Math.max(0, now - createdAt);
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

function NotificationRow({ item, now }: { item: Notification; now: number }) {
  return (
    <div
      data-testid={`notification-item-${item.id}`}
      className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
    >
      <span
        role="img"
        aria-label={LEVEL_LABEL[item.level]}
        className="mt-[6px] block size-2 shrink-0"
        style={{ backgroundColor: LEVEL_DOT_COLOR[item.level] }}
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="text-[12px] text-white/85 leading-snug break-words">
          {item.message}
        </span>
        {item.description ? (
          <span className="text-[11px] text-white/45 leading-snug break-words">
            {item.description}
          </span>
        ) : null}
        <span className="text-[11px] text-white/50 mt-0.5">
          {formatRelative(item.createdAt, now)}
        </span>
      </div>
    </div>
  );
}

export function NotificationList({
  open,
  onOpenChange,
  center = globalNotificationCenter,
}: NotificationListProps) {
  const { notifications, clear } = useNotifications(center);

  // Close on Escape while open.
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

  if (!open) return null;

  const now = Date.now();

  return (
    <>
      {/* Click-outside backdrop */}
      <button
        type="button"
        aria-label="Close notifications"
        data-testid="notifications-backdrop"
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 z-40 bg-transparent cursor-default"
      />
      <aside
        role="dialog"
        aria-label="Notifications"
        data-testid="notifications-drawer"
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-[360px] flex-col",
          "bg-[var(--color-bg-secondary)] border-l border-white/[0.06]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          "motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-200",
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-wide text-white/70 uppercase">
              Notifications
            </span>
            <span className="text-[11px] text-white/50">
              {notifications.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 ? (
              <button
                type="button"
                data-testid="notifications-clear"
                onClick={clear}
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors px-2 py-1"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              data-testid="notifications-close"
              onClick={() => onOpenChange(false)}
              className="flex size-6 items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div
              data-testid="notifications-empty"
              className="flex h-full items-center justify-center px-6 text-center"
            >
              <p className="text-[11px] text-white/50">No notifications yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((item) => (
                <NotificationRow key={item.id} item={item} now={now} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
