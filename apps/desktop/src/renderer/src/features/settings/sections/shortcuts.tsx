import { cn } from "@pi-desktop/ui";
import { useEffect, useMemo, useState } from "react";
import {
  detectPlatform,
  formatShortcut,
  globalShortcutRegistry,
  type RegisteredShortcut,
} from "@/lib/keyboard";
import { SettingsSection } from "../controls";

function groupShortcuts(
  shortcuts: ReadonlyArray<RegisteredShortcut>,
): Array<[string, RegisteredShortcut[]]> {
  const groups = new Map<string, RegisteredShortcut[]>();
  for (const entry of shortcuts) {
    const bucket = groups.get(entry.group);
    if (bucket === undefined) groups.set(entry.group, [entry]);
    else bucket.push(entry);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState<ReadonlyArray<RegisteredShortcut>>(
    () => globalShortcutRegistry.list(),
  );

  useEffect(() => {
    return globalShortcutRegistry.subscribe(setShortcuts);
  }, []);

  const platform = useMemo(() => detectPlatform(), []);
  const groups = useMemo(() => groupShortcuts(shortcuts), [shortcuts]);

  return (
    <SettingsSection
      title="Shortcuts"
      description="Keyboard shortcuts registered in this window. Press ? for the full overlay."
    >
      {groups.length === 0 ? (
        <p className="py-3 text-[11px] text-white/40">
          No shortcuts registered yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4 py-2">
          {groups.map(([groupName, items]) => (
            <section key={groupName} className="space-y-1.5">
              <h3 className="text-[10px] font-medium tracking-wide text-white/40 uppercase">
                {groupName}
              </h3>
              <ul className="space-y-0.5">
                {items.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 py-1"
                  >
                    <span className="text-[11px] text-white/75">
                      {entry.description}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {entry.parsed.map((parsed, idx) => (
                        <kbd
                          key={`${entry.id}-${idx}`}
                          className={cn(
                            "px-1.5 py-0.5 rounded-sm",
                            "border border-white/[0.08] bg-white/[0.06]",
                            "text-[10px] font-mono text-white/65",
                          )}
                        >
                          {formatShortcut(parsed, platform)}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
