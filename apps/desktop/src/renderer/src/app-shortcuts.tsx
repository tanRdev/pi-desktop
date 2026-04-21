import { useKeyboardShortcut } from "@/lib/keyboard";

/**
 * App-wide keyboard shortcuts that don't belong to a specific host.
 * Mounted once near the app root. Renders nothing.
 */
export function AppShortcuts(): null {
  useKeyboardShortcut(
    {
      id: "command-palette.open.alias",
      keys: "Mod+Shift+P",
      description: "Open command palette",
      group: "General",
      allowInInput: true,
    },
    () => {
      window.dispatchEvent(new CustomEvent("pi:command-palette:toggle"));
    },
  );

  useKeyboardShortcut(
    {
      id: "app.reload-window",
      keys: "Mod+Shift+R",
      description: "Reload window",
      group: "View",
    },
    () => {
      window.dispatchEvent(
        new CustomEvent("pi:command", {
          detail: { commandId: "reload-window" },
        }),
      );
    },
  );

  useKeyboardShortcut(
    {
      id: "app.undo",
      keys: "Mod+Z",
      description: "Undo",
      group: "Edit",
      allowInInput: true,
    },
    () => {
      window.dispatchEvent(new CustomEvent("pi:undo"));
    },
  );

  useKeyboardShortcut(
    {
      id: "app.redo",
      keys: ["Mod+Shift+Z", "Mod+Y"],
      description: "Redo",
      group: "Edit",
      allowInInput: true,
    },
    () => {
      window.dispatchEvent(new CustomEvent("pi:redo"));
    },
  );

  return null;
}
