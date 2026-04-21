import * as React from "react";
import { ShortcutHelpOverlay } from "./shortcut-help-overlay";
import {
  globalShortcutRegistry,
  type ShortcutRegistry,
} from "./shortcut-registry";

export type KeyboardHostProps = {
  registry?: ShortcutRegistry;
  /** Disable the built-in "?" help overlay. */
  disableHelpOverlay?: boolean;
};

/**
 * Mounts the single global keydown listener and the "?" help overlay.
 * Render once, near the root of the app.
 */
export function KeyboardHost({
  registry,
  disableHelpOverlay,
}: KeyboardHostProps = {}): React.ReactElement | null {
  const activeRegistry = registry ?? globalShortcutRegistry;
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      // Built-in "?" opens the help overlay unless caller disabled it.
      if (
        disableHelpOverlay !== true &&
        event.key === "?" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const target = event.target;
        const editable =
          target instanceof HTMLElement &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (!editable) {
          event.preventDefault();
          setHelpOpen((prev) => !prev);
          return;
        }
      }
      activeRegistry.handleEvent(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeRegistry, disableHelpOverlay]);

  if (disableHelpOverlay === true) return null;

  return (
    <ShortcutHelpOverlay
      open={helpOpen}
      onOpenChange={setHelpOpen}
      registry={activeRegistry}
    />
  );
}
