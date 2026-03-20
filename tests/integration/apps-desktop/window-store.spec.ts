import { describe, expect, it } from "vitest";
import {
  createWindowStore,
  getCenteredWindowPosition,
  initialWindowStoreState,
} from "../../../apps/desktop/src/renderer/src/stores/window-store";
import type { TerminalWindow } from "../../../packages/shared/src";

function requireWindow<T extends { id: string }>(
  window: T | undefined,
  label: string,
): T {
  if (!window) {
    throw new Error(`Expected window ${label} to exist`);
  }

  return window;
}

describe("window-store", () => {
  it("creates, focuses, and closes windows while tracking z-order", () => {
    const store = createWindowStore();

    const first = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const second = store.createWindow({ kind: "terminal", backend: "shell" });

    expect(store.getState().layout.windows).toHaveLength(2);
    expect(store.getState().layout.focusedWindowId).toBe(second.id);
    expect(first.width).toBe(640);
    expect(first.height).toBe(420);

    store.focusWindow(first.id);
    expect(store.getState().layout.focusedWindowId).toBe(first.id);

    store.closeWindow(first.id);
    expect(store.getState().layout.windows).toHaveLength(1);
    expect(store.getState().layout.focusedWindowId).toBe(second.id);
  });

  it("marks file and note windows dirty without mutating other window kinds", () => {
    const store = createWindowStore();

    const fileWindow = store.createWindow({
      kind: "file",
      filePath: "/tmp/a.ts",
    });
    const noteWindow = store.createWindow({ kind: "note" });
    const terminalWindow = store.createWindow({
      kind: "terminal",
      backend: "shell",
    });

    store.setDirty(fileWindow.id, true);
    store.setDirty(noteWindow.id, true);
    store.setDirty(terminalWindow.id, true);

    const windows = store.getState().layout.windows;
    const file = windows.find((window) => window.id === fileWindow.id);
    const note = windows.find((window) => window.id === noteWindow.id);
    const terminal = windows.find((window) => window.id === terminalWindow.id);

    expect(file?.kind).toBe("file");
    expect(file && "isDirty" in file ? file.isDirty : null).toBe(true);
    expect(note?.kind).toBe("note");
    expect(note && "isDirty" in note ? note.isDirty : null).toBe(true);
    expect(terminal?.kind).toBe("terminal");
    expect(terminal && "isDirty" in terminal).toBe(false);
  });

  it("cascades default positions for multiple createWindow calls", () => {
    const store = createWindowStore();

    const a = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const b = store.createWindow({ kind: "file", filePath: "/tmp/b.ts" });

    expect(b.x).toBe(a.x + 48);
    expect(b.y).toBe(a.y + 48);
  });

  it("centers windows against the visible canvas viewport", () => {
    expect(
      getCenteredWindowPosition({
        viewportWidth: 1440,
        viewportHeight: 900,
        windowWidth: 640,
        windowHeight: 420,
        zoom: 0.9,
      }),
    ).toEqual({ x: 480, y: 290 });
  });

  it("terminal createWindow falls back to passed cwd when action.cwd is missing", () => {
    const store = createWindowStore();

    const cwd = "/home/test";
    const t = store.createWindow({ kind: "terminal", backend: "shell" }, cwd);

    expect(t.kind).toBe("terminal");
    // Terminal windows should use the fallback cwd when action.cwd is absent
    // @ts-expect-error runtime property
    expect(t.cwd).toBe(cwd);
  });

  it("moveWindow only updates targeted window coordinates", () => {
    const store = createWindowStore();
    const a = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const b = store.createWindow({ kind: "file", filePath: "/tmp/b.ts" });

    const bOrigX = b.x;
    const bOrigY = b.y;

    store.moveWindow(a.id, 400, 300);

    const windows = store.getState().layout.windows;
    const wa = requireWindow(
      windows.find((w) => w.id === a.id),
      "after moving target",
    );
    const wb = requireWindow(
      windows.find((w) => w.id === b.id),
      "after moving untouched window",
    );

    expect(wa.x).toBe(400);
    expect(wa.y).toBe(300);
    expect(wb.x).toBe(bOrigX);
    expect(wb.y).toBe(bOrigY);
  });

  it("resizeWindow only updates targeted window dimensions", () => {
    const store = createWindowStore();
    const a = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const b = store.createWindow({ kind: "file", filePath: "/tmp/b.ts" });

    const bOrigW = b.width;
    const bOrigH = b.height;

    store.resizeWindow(a.id, 640, 480);

    const windows = store.getState().layout.windows;
    const wa = requireWindow(
      windows.find((w) => w.id === a.id),
      "after resizing target",
    );
    const wb = requireWindow(
      windows.find((w) => w.id === b.id),
      "after resizing untouched window",
    );

    expect(wa.width).toBe(640);
    expect(wa.height).toBe(480);
    expect(wb.width).toBe(bOrigW);
    expect(wb.height).toBe(bOrigH);
  });

  it("SET_WINDOW_STATE (minimize) transfers focus deterministically or clears focus", () => {
    const store = createWindowStore();

    const a = store.createWindow({ kind: "file", filePath: "/tmp/1" });
    const b = store.createWindow({ kind: "file", filePath: "/tmp/2" });
    const c = store.createWindow({ kind: "file", filePath: "/tmp/3" });

    // make b the top z and focused
    store.focusWindow(b.id);

    // minimizing the focused window should move focus to the highest-z non-minimized window
    store.dispatch({
      type: "SET_WINDOW_STATE",
      payload: { windowId: b.id, state: "minimized" },
    });
    const focusedAfterMinimize = store.getState().layout.focusedWindowId;

    // expected: c is highest-z non-minimized window
    expect(focusedAfterMinimize).toBe(c.id);

    // now minimize the remaining non-minimized windows and expect focus to become null
    store.dispatch({
      type: "SET_WINDOW_STATE",
      payload: { windowId: a.id, state: "minimized" },
    });
    store.dispatch({
      type: "SET_WINDOW_STATE",
      payload: { windowId: c.id, state: "minimized" },
    });
    expect(store.getState().layout.focusedWindowId).toBe(null);
  });

  it("closeWindow does not re-focus a minimized window when a non-minimized window exists", () => {
    const store = createWindowStore();

    const a = store.createWindow({ kind: "file", filePath: "/tmp/a" });
    const b = store.createWindow({ kind: "file", filePath: "/tmp/b" });
    const c = store.createWindow({ kind: "file", filePath: "/tmp/c" });

    // make b the top z and focused
    store.focusWindow(b.id);

    // minimize c (so the highest-z remaining window after closing b would be c but it is minimized)
    store.dispatch({
      type: "SET_WINDOW_STATE",
      payload: { windowId: c.id, state: "minimized" },
    });

    // close the currently focused window (b)
    store.closeWindow(b.id);

    // expected: should pick highest-z non-minimized window (a), not the minimized c
    expect(store.getState().layout.focusedWindowId).toBe(a.id);
  });

  it("setSnapPreview sets then clears preview", () => {
    const store = createWindowStore();
    const w = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const pos = { x: 10, y: 10, width: 100, height: 100 };

    store.setSnapPreview({ windowId: w.id, position: pos });
    expect(store.getState().snapPreview).toEqual({
      windowId: w.id,
      position: pos,
    });

    store.setSnapPreview(null);
    expect(store.getState().snapPreview).toBeNull();
  });

  it("updateWindow supports renderer updates while preserving stable identity", () => {
    const store = createWindowStore();

    const term = store.createWindow({ kind: "terminal", backend: "pi-linked" });
    const originalId = term.id;
    const originalZ = term.zIndex;

    store.updateWindow(term.id, {
      linkedThreadId: "thread-1",
      title: "My Terminal",
    });
    const updated = requireWindow(
      store.getState().layout.windows.find((w) => w.id === term.id),
      "updated terminal window",
    );
    expect(updated.kind).toBe("terminal");
    const updatedTerminal = updated as TerminalWindow;

    expect(updated.id).toBe(originalId);
    expect(updatedTerminal.linkedThreadId).toBe("thread-1");
    expect(updated.title).toBe("My Terminal");
    expect(updated.zIndex).toBe(originalZ);
  });

  it("updateWindow ignores managed focus and z-order fields", () => {
    const store = createWindowStore();

    const first = store.createWindow({ kind: "file", filePath: "/tmp/a" });
    const second = store.createWindow({ kind: "file", filePath: "/tmp/b" });

    const originalFirstZIndex = first.zIndex;

    store.updateWindow(first.id, {
      title: "Renamed",
      isFocused: true,
      zIndex: 999,
    });

    const windows = store.getState().layout.windows;
    const updatedFirst = windows.find((window) => window.id === first.id);
    const updatedSecond = windows.find((window) => window.id === second.id);

    expect(store.getState().layout.focusedWindowId).toBe(second.id);
    expect(updatedFirst?.title).toBe("Renamed");
    expect(updatedFirst?.isFocused).toBe(false);
    expect(updatedFirst?.zIndex).toBe(originalFirstZIndex);
    expect(updatedSecond?.isFocused).toBe(true);
  });

  it("updateWindow preserves identity while routing state changes through focus rules", () => {
    const store = createWindowStore();

    const first = store.createWindow({ kind: "file", filePath: "/tmp/a" });
    const second = store.createWindow({ kind: "file", filePath: "/tmp/b" });

    store.focusWindow(first.id);

    store.updateWindow(first.id, {
      id: "hacked-window-id",
      state: "minimized",
      title: "Renamed while minimizing",
    });

    const windows = store.getState().layout.windows;
    const updatedFirst = windows.find((window) => window.id === first.id);
    const updatedSecond = windows.find((window) => window.id === second.id);

    expect(windows.some((window) => window.id === "hacked-window-id")).toBe(
      false,
    );
    expect(updatedFirst?.title).toBe("Renamed while minimizing");
    expect(updatedFirst?.state).toBe("minimized");
    expect(updatedFirst?.isFocused).toBe(false);
    expect(updatedSecond?.isFocused).toBe(true);
    expect(store.getState().layout.focusedWindowId).toBe(second.id);
  });

  it("clearAll restores the initial store state", () => {
    const store = createWindowStore();
    store.createWindow({ kind: "file", filePath: "/tmp/a" });
    store.setSnapPreview({
      windowId: "x",
      position: { x: 0, y: 0, width: 1, height: 1 },
    });

    store.clearAll();
    expect(store.getState()).toEqual(initialWindowStoreState);
  });

  it("clearAll returns a fresh initial-state snapshot", () => {
    const store = createWindowStore();

    store.createWindow({ kind: "file", filePath: "/tmp/a" });
    store.clearAll();

    expect(store.getState()).toEqual(initialWindowStoreState);
    expect(store.getState()).not.toBe(initialWindowStoreState);
    expect(store.getState().layout).not.toBe(initialWindowStoreState.layout);
  });
});
