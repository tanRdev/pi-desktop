import { describe, expect, it } from "vitest";
import { createWindowStore } from "../../../apps/desktop/src/renderer/src/stores/window-store";

describe("window-store", () => {
  it("creates, focuses, and closes windows while tracking z-order", () => {
    const store = createWindowStore();

    const first = store.createWindow({ kind: "file", filePath: "/tmp/a.ts" });
    const second = store.createWindow({ kind: "terminal", backend: "shell" });

    expect(store.getState().layout.windows).toHaveLength(2);
    expect(store.getState().layout.focusedWindowId).toBe(second.id);

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
});
