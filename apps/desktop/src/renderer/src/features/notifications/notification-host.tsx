import { useState } from "react";
import { useKeyboardShortcut } from "@/lib/keyboard";
import {
  globalNotificationCenter,
  type NotificationCenter,
} from "./notification-center";
import { NotificationList } from "./notification-list";

export interface NotificationHostProps {
  center?: NotificationCenter;
  /** Initial drawer open state (used in tests). */
  defaultOpen?: boolean;
}

/**
 * Hosts the notifications drawer and registers Mod+Shift+N to toggle it
 * via the global keyboard shortcut registry (A4).
 *
 * Render once near the root of the app.
 */
export function NotificationHost({
  center = globalNotificationCenter,
  defaultOpen = false,
}: NotificationHostProps = {}) {
  const [open, setOpen] = useState(defaultOpen);

  useKeyboardShortcut(
    {
      id: "notifications.toggle-drawer",
      keys: "Mod+Shift+N",
      description: "Toggle notifications drawer",
      group: "App",
      allowInInput: true,
    },
    () => {
      setOpen((prev) => !prev);
    },
  );

  return (
    <NotificationList open={open} onOpenChange={setOpen} center={center} />
  );
}
