import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import type { SnapshotApi } from "./snapshot-api";
import { useSnapshots } from "./use-snapshots";

export interface SnapshotHostProps {
  api?: SnapshotApi;
  shortcutId?: string;
}

const INDICATOR_DURATION_MS = 1800;

function SnapshotHostInner({
  api,
  shortcutId,
}: {
  api: SnapshotApi;
  shortcutId: string;
}): React.ReactElement {
  const { snapshots, create } = useSnapshots(api);
  const [justSaved, setJustSaved] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShortcut = React.useCallback(() => {
    create("manual");
    setJustSaved(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setJustSaved(false);
      timerRef.current = null;
    }, INDICATOR_DURATION_MS);
  }, [create]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useKeyboardShortcut(
    {
      id: shortcutId,
      keys: "Mod+Shift+S",
      description: "Save workspace snapshot",
      group: "Workspace",
    },
    handleShortcut,
  );

  if (!justSaved && snapshots.length === 0) {
    return <React.Fragment />;
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-[9999] pointer-events-none",
        "flex items-center gap-2 px-3 py-1.5 rounded-full",
        "bg-[var(--color-bg-primary)] border border-white/10 shadow-lg",
        "text-[11px] text-white/70 font-mono",
        "transition-opacity duration-500",
        justSaved ? "opacity-100" : "opacity-0",
      )}
      data-testid="snapshot-indicator"
    >
      {justSaved ? (
        <span className="text-[var(--color-success)]">Snapshot saved</span>
      ) : null}
      {!justSaved && snapshots.length > 0 ? (
        <span>
          {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}

export function SnapshotHost({
  api,
  shortcutId = "snapshots.create",
}: SnapshotHostProps): React.ReactElement {
  if (!api) {
    return <React.Fragment />;
  }
  return <SnapshotHostInner api={api} shortcutId={shortcutId} />;
}
