// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";
import { createShortcutRegistry } from "../keyboard/shortcut-registry";
import { useNavRing } from "./use-nav-ring";

function dispatchKey(init: {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: init.key,
    metaKey: init.meta ?? false,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe("useNavRing", () => {
  it("registers F6 keyboard shortcut for focusNext", () => {
    const reg = createShortcutRegistry({ platform: "mac" });

    function Harness(): React.ReactElement {
      useNavRing(["sidebar", "editor", "terminal"], { registry: reg });
      return <div />;
    }

    const { unmount } = render(<Harness />);

    const registered = reg.list();
    const nextShortcut = registered.find((s) => s.id === "nav-ring:focus-next");
    expect(nextShortcut).toBeDefined();
    expect(nextShortcut?.rawKeys).toContain("F6");
    unmount();
  });

  it("registers Mod+F6 keyboard shortcut for focusPrevious", () => {
    const reg = createShortcutRegistry({ platform: "mac" });

    function Harness(): React.ReactElement {
      useNavRing(["sidebar", "editor", "terminal"], { registry: reg });
      return <div />;
    }

    const { unmount } = render(<Harness />);

    const registered = reg.list();
    const prevShortcut = registered.find(
      (s) => s.id === "nav-ring:focus-previous",
    );
    expect(prevShortcut).toBeDefined();
    expect(prevShortcut?.rawKeys).toContain("Mod+F6");
    unmount();
  });

  it("cleans up shortcuts on unmount", () => {
    const reg = createShortcutRegistry({ platform: "mac" });

    function Harness(): React.ReactElement {
      useNavRing(["sidebar", "editor", "terminal"], { registry: reg });
      return <div />;
    }

    const { unmount } = render(<Harness />);

    expect(reg.list().some((s) => s.id === "nav-ring:focus-next")).toBe(true);
    expect(reg.list().some((s) => s.id === "nav-ring:focus-previous")).toBe(
      true,
    );

    unmount();

    expect(reg.list().some((s) => s.id === "nav-ring:focus-next")).toBe(false);
    expect(reg.list().some((s) => s.id === "nav-ring:focus-previous")).toBe(
      false,
    );
  });

  it("F6 advances to next region and wraps", () => {
    const reg = createShortcutRegistry({ platform: "mac" });

    let currentRegionValue = "";

    function Harness(): React.ReactElement {
      const { currentRegion } = useNavRing(["sidebar", "editor", "terminal"], {
        registry: reg,
      });
      currentRegionValue = currentRegion;
      return <div />;
    }

    render(<Harness />);

    expect(currentRegionValue).toBe("sidebar");

    act(() => {
      reg.handleEvent(dispatchKey({ key: "F6" }));
    });
    expect(currentRegionValue).toBe("editor");

    act(() => {
      reg.handleEvent(dispatchKey({ key: "F6" }));
    });
    expect(currentRegionValue).toBe("terminal");

    act(() => {
      reg.handleEvent(dispatchKey({ key: "F6" }));
    });
    expect(currentRegionValue).toBe("sidebar");
  });

  it("Mod+F6 moves to previous region and wraps", () => {
    const reg = createShortcutRegistry({ platform: "mac" });

    let currentRegionValue = "";

    function Harness(): React.ReactElement {
      const { currentRegion } = useNavRing(["sidebar", "editor", "terminal"], {
        registry: reg,
      });
      currentRegionValue = currentRegion;
      return <div />;
    }

    render(<Harness />);

    expect(currentRegionValue).toBe("sidebar");

    act(() => {
      reg.handleEvent(dispatchKey({ key: "F6", meta: true }));
    });
    expect(currentRegionValue).toBe("terminal");

    act(() => {
      reg.handleEvent(dispatchKey({ key: "F6", meta: true }));
    });
    expect(currentRegionValue).toBe("editor");
  });
});
