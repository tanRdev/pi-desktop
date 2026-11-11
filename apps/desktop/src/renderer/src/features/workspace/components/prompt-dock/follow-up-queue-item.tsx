import type { FollowUpItem } from "@pi-desktop/shared";
import { Button, cn } from "@pi-desktop/ui";
import * as React from "react";

/** One row of the follow-up queue list (issue #10). */
export interface FollowUpQueueItemProps {
  item: FollowUpItem;
  index: number;
  itemCount: number;
  supportsSteer: boolean;
  onEdit: (itemId: string, text: string) => void;
  onDelete: (itemId: string) => void;
  onMove: (itemId: string, offset: -1 | 1) => void;
  onRetry: (itemId: string) => void;
  onSteerItem: (itemId: string) => void;
}

const STATUS_LABEL: Record<FollowUpItem["status"], string> = {
  queued: "Queued",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};

export function smallButtonClassName(): string {
  return "h-5 px-1.5 text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]";
}

export function FollowUpQueueItem({
  item,
  index,
  itemCount,
  supportsSteer,
  onEdit,
  onDelete,
  onMove,
  onRetry,
  onSteerItem,
}: FollowUpQueueItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingText, setEditingText] = React.useState("");
  const canModify = item.status === "queued" || item.status === "failed";

  return (
    <li
      data-testid="follow-up-item"
      data-item-id={item.id}
      data-status={item.status}
      className="flex items-start gap-2 rounded-sm px-1 py-0.5"
    >
      <span
        className={cn(
          "mt-0.5 shrink-0 rounded-sm px-1 py-px text-[9px] font-medium uppercase tracking-wide",
          item.status === "failed"
            ? "bg-red-500/15 text-red-300"
            : item.status === "sent"
              ? "bg-emerald-500/15 text-emerald-300"
              : item.status === "sending"
                ? "bg-amber-500/15 text-amber-300"
                : "bg-white/[0.06] text-white/50",
        )}
        title={item.lastError ?? undefined}
      >
        {STATUS_LABEL[item.status]}
      </span>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex flex-col gap-1">
            <textarea
              data-testid="follow-up-edit-input"
              value={editingText}
              onChange={(event) => setEditingText(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-sm border border-white/[0.08] bg-transparent px-1 py-0.5 text-[11px] text-[var(--color-text-primary)] focus:outline-none"
            />
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="follow-up-edit-save"
                className={smallButtonClassName()}
                onClick={() => {
                  onEdit(item.id, editingText);
                  setIsEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={smallButtonClassName()}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p
            className="truncate text-[11px] text-[var(--color-text-primary)]"
            title={item.text}
          >
            {item.text}
            {item.images.length > 0
              ? ` · ${item.images.length} image${item.images.length === 1 ? "" : "s"}`
              : ""}
          </p>
        )}
        {item.status === "failed" && item.lastError ? (
          <p className="truncate text-[10px] text-red-300/80">
            {item.lastError}
          </p>
        ) : null}
      </div>

      {!isEditing ? (
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Move follow-up up"
            data-testid="follow-up-move-up"
            disabled={index === 0 || item.status === "sending"}
            className={smallButtonClassName()}
            onClick={() => onMove(item.id, -1)}
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Move follow-up down"
            data-testid="follow-up-move-down"
            disabled={index === itemCount - 1 || item.status === "sending"}
            className={smallButtonClassName()}
            onClick={() => onMove(item.id, 1)}
          >
            ↓
          </Button>
          {canModify ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="follow-up-edit"
              className={smallButtonClassName()}
              onClick={() => {
                setIsEditing(true);
                setEditingText(item.text);
              }}
            >
              Edit
            </Button>
          ) : null}
          {item.status === "failed" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="follow-up-retry"
              className={smallButtonClassName()}
              onClick={() => onRetry(item.id)}
            >
              Retry
            </Button>
          ) : null}
          {supportsSteer && canModify ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="follow-up-steer"
              className={smallButtonClassName()}
              onClick={() => onSteerItem(item.id)}
            >
              Steer
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="follow-up-delete"
            disabled={item.status === "sending"}
            className={smallButtonClassName()}
            onClick={() => onDelete(item.id)}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </li>
  );
}
