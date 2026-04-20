import { useCallback, useEffect, useState } from "react";
import { globalShortcutRegistry } from "@/lib/keyboard";
import { SettingsDialog } from "./settings-dialog";

/**
 * Mount-once host that owns the open/closed state and the Cmd+, / Ctrl+,
 * hotkey. Drop `<SettingsHost />` anywhere near the app root.
 */
export function SettingsHost() {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  useEffect(() => {
    const unregister = globalShortcutRegistry.register({
      id: "settings.open",
      keys: "Mod+,",
      description: "Open settings",
      group: "General",
      allowInInput: true,
      run: () => {
        setOpen((prev) => !prev);
      },
    });
    return unregister;
  }, []);

  return <SettingsDialog open={open} onOpenChange={handleOpenChange} />;
}
