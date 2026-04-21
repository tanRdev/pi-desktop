import { useCallback, useEffect, useState } from "react";
import { globalShortcutRegistry } from "@/lib/keyboard";
import { SettingsDialog } from "./settings-dialog";

type PiCommandEventDetail = {
  commandId?: string;
};

/**
 * Mount-once host that owns the open/closed state and the Cmd+, / Ctrl+,
 * hotkey. Drop `<SettingsHost />` anywhere near the app root.
 */
export function SettingsHost() {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  const openSettings = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    const unregister = globalShortcutRegistry.register({
      id: "settings.open",
      keys: "Mod+,",
      description: "Open settings",
      group: "General",
      allowInInput: true,
      run: openSettings,
    });
    return unregister;
  }, [openSettings]);

  useEffect(() => {
    const handleSharedCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as PiCommandEventDetail | undefined;
      if (
        detail?.commandId === "open-settings" ||
        detail?.commandId === "settings"
      ) {
        openSettings();
      }
    };

    window.addEventListener("pi:command", handleSharedCommand);
    window.addEventListener("pi:command:open-settings", openSettings);

    return () => {
      window.removeEventListener("pi:command", handleSharedCommand);
      window.removeEventListener("pi:command:open-settings", openSettings);
    };
  }, [openSettings]);

  return <SettingsDialog open={open} onOpenChange={handleOpenChange} />;
}
