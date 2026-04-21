// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppShortcuts } from "./app-shortcuts";
import { globalShortcutRegistry } from "./lib/keyboard";

describe("AppShortcuts", () => {
  beforeEach(() => {
    globalShortcutRegistry.clear();
  });

  afterEach(() => {
    cleanup();
    globalShortcutRegistry.clear();
  });

  it("dispatches reload-window through the shared command payload", () => {
    const events: Array<string> = [];
    const listener = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail;
      if (!detail || typeof detail !== "object") {
        return;
      }

      const commandId = Reflect.get(detail, "commandId");
      if (typeof commandId === "string") {
        events.push(commandId);
      }
    };

    window.addEventListener("pi:command", listener);
    render(<AppShortcuts />);

    expect(
      globalShortcutRegistry
        .list()
        .some((entry) => entry.id === "app.reload-window"),
    ).toBe(true);

    act(() => {
      const reloadShortcut = globalShortcutRegistry
        .list()
        .find((entry) => entry.id === "app.reload-window");

      if (!reloadShortcut) {
        throw new Error("Expected reload shortcut to be registered");
      }

      reloadShortcut.run(new KeyboardEvent("keydown"));
    });

    expect(events).toEqual(["reload-window"]);

    window.removeEventListener("pi:command", listener);
  });
});
