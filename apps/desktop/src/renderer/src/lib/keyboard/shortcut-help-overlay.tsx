import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { detectPlatform, formatShortcut } from "./parse-shortcut";
import {
  globalShortcutRegistry,
  type RegisteredShortcut,
  type ShortcutRegistry,
} from "./shortcut-registry";

export type ShortcutHelpOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry?: ShortcutRegistry;
};

function groupShortcuts(
  shortcuts: ReadonlyArray<RegisteredShortcut>,
): Array<[string, RegisteredShortcut[]]> {
  const groups = new Map<string, RegisteredShortcut[]>();
  for (const s of shortcuts) {
    const bucket = groups.get(s.group);
    if (bucket === undefined) groups.set(s.group, [s]);
    else bucket.push(s);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function ShortcutHelpOverlay({
  open,
  onOpenChange,
  registry,
}: ShortcutHelpOverlayProps): React.ReactElement {
  const activeRegistry = registry ?? globalShortcutRegistry;
  const [shortcuts, setShortcuts] = React.useState<
    ReadonlyArray<RegisteredShortcut>
  >(() => activeRegistry.list());

  React.useEffect(() => {
    return activeRegistry.subscribe(setShortcuts);
  }, [activeRegistry]);

  const platform = React.useMemo(() => detectPlatform(), []);
  const groups = React.useMemo(() => groupShortcuts(shortcuts), [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-pi-shortcut-help-overlay="true" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press ? again or Escape to dismiss.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4 space-y-6 text-sm">
          {groups.length === 0 ? (
            <div className="text-white/40 text-xs">
              No shortcuts registered yet.
            </div>
          ) : (
            groups.map(([groupName, items]) => (
              <section key={groupName} className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-white/40">
                  {groupName}
                </h3>
                <ul className="space-y-1">
                  {items.map((entry) => (
                    <li
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between gap-4",
                        "py-1",
                      )}
                    >
                      <span className="text-white/80">{entry.description}</span>
                      <span className="flex gap-1">
                        {entry.parsed.map((p, idx) => (
                          <kbd
                            key={`${entry.id}-${idx}`}
                            className={cn(
                              "px-1.5 py-0.5 rounded",
                              "border border-white/[0.08]",
                              "bg-white/[0.04]",
                              "text-xs font-mono text-white/70",
                            )}
                          >
                            {formatShortcut(p, platform)}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
