import type { FollowUpQueueState } from "@pi-desktop/shared";
import { Button } from "@pi-desktop/ui";
import {
  FollowUpQueueItem,
  smallButtonClassName,
} from "./follow-up-queue-item";

/**
 * The per-thread follow-up queue rendered above the composer (issue #10).
 * Shows explicit per-item delivery status and the queue operations:
 * edit, delete, reorder, retry, steer, and pause/resume dispatch.
 */
export interface FollowUpQueueProps {
  queue?: FollowUpQueueState;
  supportsSteer: boolean;
  onEdit: (itemId: string, text: string) => void;
  onDelete: (itemId: string) => void;
  onMove: (itemId: string, offset: -1 | 1) => void;
  onTogglePaused: () => void;
  onRetry: (itemId: string) => void;
  onSteerItem: (itemId: string) => void;
}

export function FollowUpQueue({
  queue,
  supportsSteer,
  onEdit,
  onDelete,
  onMove,
  onTogglePaused,
  onRetry,
  onSteerItem,
}: FollowUpQueueProps) {
  if (!queue || queue.items.length === 0) {
    return null;
  }

  const pendingCount = queue.items.filter(
    (item) => item.status === "queued" || item.status === "sending",
  ).length;

  return (
    <div
      data-testid="follow-up-queue"
      className="mx-2 mb-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
          Follow-ups{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="follow-up-pause-toggle"
          className={smallButtonClassName()}
          onClick={onTogglePaused}
        >
          {queue.paused ? "Resume" : "Pause"}
        </Button>
      </div>
      {queue.paused && pendingCount > 0 ? (
        <p className="mb-1 text-[10px] leading-4 text-white/40">
          Queue paused — follow-ups will not send until resumed.
        </p>
      ) : null}
      <ul className="flex flex-col">
        {queue.items.map((item, index) => (
          <FollowUpQueueItem
            key={item.id}
            item={item}
            index={index}
            itemCount={queue.items.length}
            supportsSteer={supportsSteer}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
            onRetry={onRetry}
            onSteerItem={onSteerItem}
          />
        ))}
      </ul>
    </div>
  );
}
