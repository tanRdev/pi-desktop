import * as React from "react";
import { globalShortcutRegistry } from "@/lib/keyboard";
import { CommandPalette } from "./command-palette";
import { installDefaultCommands } from "./default-commands";

/**
 * Mount-once host for the command palette.
 *
 * - Registers the default command set on mount.
 * - Registers the Cmd+K / Ctrl+K shortcut via the global keyboard registry
 *   so the help overlay can discover it.
 * - Also listens for `pi:command-palette:open` / `:close` / `:toggle` custom events
 *   so other parts of the app can control it without importing React state.
 */
export function CommandPaletteHost() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const dispose = installDefaultCommands();
    return dispose;
  }, []);

  React.useEffect(() => {
    const unregister = globalShortcutRegistry.register({
      id: "command-palette.open",
      keys: "Mod+K",
      description: "Open command palette",
      group: "General",
      allowInInput: true,
      run: () => {
        setOpen((prev) => !prev);
      },
    });
    return unregister;
  }, []);

  React.useEffect(() => {
    const openHandler = () => setOpen(true);
    const closeHandler = () => setOpen(false);
    const toggleHandler = () => setOpen((p) => !p);
    window.addEventListener("pi:command-palette:open", openHandler);
    window.addEventListener("pi:command-palette:close", closeHandler);
    window.addEventListener("pi:command-palette:toggle", toggleHandler);
    return () => {
      window.removeEventListener("pi:command-palette:open", openHandler);
      window.removeEventListener("pi:command-palette:close", closeHandler);
      window.removeEventListener("pi:command-palette:toggle", toggleHandler);
    };
  }, []);

  return <CommandPalette open={open} onOpenChange={setOpen} />;
}
