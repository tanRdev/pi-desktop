import { Button, cn } from "@pi-desktop/ui";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Delete,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
} from "@/components/ui/phosphor-icons";
import type { SnapshotApi } from "./snapshot-api";
import type { SnapshotRestoreResult } from "./snapshot-store";
import { useSnapshots } from "./use-snapshots";

export interface SnapshotPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: SnapshotApi;
  /** Surface restore feedback (success or refusal). Defaults to console. */
  onRestoreFeedback?: (result: SnapshotRestoreResult) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString();
}

function describeRestore(result: SnapshotRestoreResult): string {
  switch (result.kind) {
    case "ok":
      return "Snapshot restored.";
    case "migrated":
      return `Snapshot restored (migrated from v${result.from}).`;
    case "refused-newer":
      return `Refused: snapshot is v${result.snapshotVersion}, current is v${result.currentVersion}.`;
    case "not-found":
      return "Snapshot not found.";
    case "corrupt":
      return `Snapshot is corrupt: ${result.reason}.`;
  }
}

export function SnapshotPanel({
  open,
  onOpenChange,
  api,
  onRestoreFeedback,
}: SnapshotPanelProps): React.ReactElement {
  const { snapshots, refresh, create, restore, remove, exportSnapshot } =
    useSnapshots(api);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  // Refresh on open so the list reflects any background autosave activity.
  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleRestore = React.useCallback(
    (ts: number) => {
      const result = restore(ts);
      setFeedback(describeRestore(result));
      onRestoreFeedback?.(result);
    },
    [restore, onRestoreFeedback],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="snapshot-panel">
        <DialogHeader>
          <DialogTitle>Workspace snapshots</DialogTitle>
          <DialogDescription>
            Restore, export, or delete recent local snapshots of your workspace
            session. Up to {snapshots.length > 0 ? snapshots.length : "5"}{" "}
            snapshots are kept.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-6 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const meta = create("manual");
              setFeedback(
                meta === null
                  ? "Could not create snapshot (no active session?)."
                  : `Snapshot saved at ${formatTimestamp(meta.ts)}.`,
              );
            }}
            data-testid="snapshot-create"
          >
            <Save className="size-4 mr-2" />
            Save snapshot
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refresh}
            data-testid="snapshot-refresh"
          >
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div
          className="max-h-[320px] overflow-y-auto px-6"
          data-testid="snapshot-list"
        >
          {snapshots.length === 0 ? (
            <p className="text-[11px] text-white/40 py-8 text-center">
              No snapshots yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-white/[0.06]">
              {snapshots.map((snap) => (
                <li
                  key={snap.ts}
                  className={cn("flex items-center justify-between gap-3 py-3")}
                  data-testid={`snapshot-row-${snap.ts}`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-white/80 truncate">
                      {formatTimestamp(snap.ts)}
                      {snap.label ? ` · ${snap.label}` : ""}
                    </span>
                    <span className="text-[11px] text-white/40">
                      v{snap.schemaVersion} · {snap.windowCount} window
                      {snap.windowCount === 1 ? "" : "s"} ·{" "}
                      {formatBytes(snap.byteSize)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(snap.ts)}
                      data-testid={`snapshot-restore-${snap.ts}`}
                      aria-label="Restore snapshot"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        exportSnapshot(snap.ts);
                      }}
                      data-testid={`snapshot-export-${snap.ts}`}
                      aria-label="Export snapshot"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        remove(snap.ts);
                        setFeedback("Snapshot deleted.");
                      }}
                      data-testid={`snapshot-delete-${snap.ts}`}
                      aria-label="Delete snapshot"
                    >
                      <Delete className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {feedback !== null ? (
          <p
            className="text-[11px] text-white/50 px-6 pt-2"
            data-testid="snapshot-feedback"
          >
            {feedback}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
