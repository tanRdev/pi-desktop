import type { FileWindow } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import {
  applyWindowUpdates,
  pickNextFocusableWindowId,
  syncFocusedWindowState,
} from "./window-store-reducer";

function createFileWindow(
  id: string,
  overrides: Partial<FileWindow> = {},
): FileWindow {
  return {
    id,
    kind: "file",
    title: `${id}.ts`,
    filePath: `/tmp/${id}.ts`,
    x: 0,
    y: 0,
    width: 640,
    height: 420,
    zIndex: 1,
    isFocused: false,
    state: "normal",
    isDirty: false,
    ...overrides,
  };
}

describe("window-store-reducer", () => {
  it("ignores managed identity and focus fields in window updates", () => {
    const window = createFileWindow("alpha", {
      zIndex: 7,
      isFocused: true,
    });

    const updated = applyWindowUpdates(window, {
      title: "Renamed",
      id: "hacked-id",
      isFocused: false,
      zIndex: 99,
    });

    expect(updated.id).toBe("alpha");
    expect(updated.title).toBe("Renamed");
    expect(updated.isFocused).toBe(true);
    expect(updated.zIndex).toBe(7);
  });

  it("picks the highest-z non-minimized window for focus", () => {
    const windows = [
      createFileWindow("alpha", { zIndex: 2 }),
      createFileWindow("beta", { zIndex: 9, state: "minimized" }),
      createFileWindow("gamma", { zIndex: 7 }),
    ];

    expect(pickNextFocusableWindowId(windows)).toBe("gamma");
  });

  it("syncs focused window state against the focused id", () => {
    const windows = [
      createFileWindow("alpha", { isFocused: true }),
      createFileWindow("beta", { isFocused: false }),
    ];

    expect(syncFocusedWindowState(windows, "beta")).toEqual([
      expect.objectContaining({ id: "alpha", isFocused: false }),
      expect.objectContaining({ id: "beta", isFocused: true }),
    ]);
  });
});
