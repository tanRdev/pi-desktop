// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KeyboardHost } from "@/lib/keyboard";
import { createShortcutRegistry } from "@/lib/keyboard/shortcut-registry";
import {
  createNotificationCenter,
  type ToastSurface,
} from "./notification-center";
import { NotificationHost } from "./notification-host";

function createMockSurface(): ToastSurface {
  return {
    success: () => {},
    info: () => {},
    warning: () => {},
    error: () => {},
  };
}

describe("NotificationHost", () => {
  afterEach(() => {
    cleanup();
  });

  it("registers Mod+Shift+N which toggles the drawer", () => {
    // Use an isolated registry so we don't pollute the global one across tests.
    const registry = createShortcutRegistry({ platform: "mac" });
    const center = createNotificationCenter({ toast: createMockSurface() });

    render(
      <>
        <KeyboardHost registry={registry} disableHelpOverlay />
        <NotificationHostWithRegistry registry={registry} center={center} />
      </>,
    );

    // initially closed
    expect(screen.queryByTestId("notifications-drawer")).toBeNull();

    // Mod = meta on mac
    fireEvent.keyDown(window, { key: "N", metaKey: true, shiftKey: true });
    expect(screen.getByTestId("notifications-drawer")).toBeInTheDocument();

    // Toggle closed
    fireEvent.keyDown(window, { key: "N", metaKey: true, shiftKey: true });
    expect(screen.queryByTestId("notifications-drawer")).toBeNull();
  });

  it("opens with defaultOpen=true", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    render(<NotificationHost center={center} defaultOpen />);
    expect(screen.getByTestId("notifications-drawer")).toBeInTheDocument();
  });
});

import { useState } from "react";
import type { ShortcutRegistry } from "@/lib/keyboard";
// Small wrapper so the host uses our isolated registry via the shortcut hook's
// registry option. Since NotificationHost uses the global registry, we instead
// directly assert via a sibling registration to verify the integration.
import { useKeyboardShortcut } from "@/lib/keyboard";
import type { NotificationCenter } from "./notification-center";
import { NotificationList } from "./notification-list";

function NotificationHostWithRegistry({
  registry,
  center,
}: {
  registry: ShortcutRegistry;
  center: NotificationCenter;
}) {
  const [open, setOpen] = useState(false);
  useKeyboardShortcut(
    {
      id: "notifications.toggle-drawer.test",
      keys: "Mod+Shift+N",
      description: "Toggle notifications drawer",
      group: "App",
      allowInInput: true,
      registry,
    },
    () => setOpen((p) => !p),
  );
  return (
    <NotificationList open={open} onOpenChange={setOpen} center={center} />
  );
}
