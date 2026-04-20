// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { createShortcutRegistry } from "./shortcut-registry";
import { useKeyboardShortcut } from "./use-keyboard-shortcut";

function dispatchKey(init: {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", {
    key: init.key,
    metaKey: init.meta ?? false,
    ctrlKey: init.ctrl ?? false,
    shiftKey: init.shift ?? false,
    altKey: init.alt ?? false,
    bubbles: true,
    cancelable: true,
  });
  return ev;
}

describe("useKeyboardShortcut", () => {
  it("fires callback on matching key", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const onFire = vi.fn();

    function Harness(): React.ReactElement {
      useKeyboardShortcut(
        {
          id: "test",
          keys: "Mod+K",
          description: "Test",
          group: "g",
          registry: reg,
        },
        onFire,
      );
      return <div />;
    }

    render(<Harness />);
    act(() => {
      reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("cleans up on unmount", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const onFire = vi.fn();

    function Harness(): React.ReactElement {
      useKeyboardShortcut(
        {
          id: "test",
          keys: "Mod+K",
          description: "Test",
          group: "g",
          registry: reg,
        },
        onFire,
      );
      return <div />;
    }

    const { unmount } = render(<Harness />);
    expect(reg.list()).toHaveLength(1);
    unmount();
    expect(reg.list()).toHaveLength(0);
    reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    expect(onFire).not.toHaveBeenCalled();
  });

  it("respects `when` predicate", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const onFire = vi.fn();

    function Harness({ enabled }: { enabled: boolean }): React.ReactElement {
      useKeyboardShortcut(
        {
          id: "test",
          keys: "Mod+K",
          description: "Test",
          group: "g",
          when: () => enabled,
          registry: reg,
        },
        onFire,
      );
      return <div />;
    }

    const { rerender } = render(<Harness enabled={false} />);
    act(() => {
      reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    });
    expect(onFire).not.toHaveBeenCalled();

    rerender(<Harness enabled={true} />);
    act(() => {
      reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest callback without re-registering", () => {
    const reg = createShortcutRegistry({ platform: "mac" });
    const first = vi.fn();
    const second = vi.fn();

    function Harness({
      cb,
    }: {
      cb: (e: KeyboardEvent) => void;
    }): React.ReactElement {
      useKeyboardShortcut(
        {
          id: "test",
          keys: "Mod+K",
          description: "Test",
          group: "g",
          registry: reg,
        },
        cb,
      );
      return <div />;
    }

    const { rerender } = render(<Harness cb={first} />);
    act(() => {
      reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender(<Harness cb={second} />);
    act(() => {
      reg.handleEvent(dispatchKey({ key: "k", meta: true }));
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
