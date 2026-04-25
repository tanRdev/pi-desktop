import { createEmptyWorkspaceSession } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";

import {
  clearWorkspaceSessionWindows,
  focusWorkspaceSessionWindow,
  moveWorkspaceSessionWindow,
  reorderWorkspaceSessionWindows,
  resetWorkspaceSessionZoom,
  resizeWorkspaceSessionWindow,
  setWorkspaceSessionDirty,
  setWorkspaceSessionPan,
  setWorkspaceSessionZoom,
  updateWorkspaceSessionWindow,
  zoomWorkspaceSessionIn,
  zoomWorkspaceSessionOut,
} from "./workspace-session-store-window-actions";

describe("workspace-session-store-window-actions", () => {
  it("applies focus, geometry, ordering, and zoom mutations without mutating the source session", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      layout: {
        ...createEmptyWorkspaceSession("wt-1").layout,
        windows: [
          {
            id: "note-1",
            kind: "note" as const,
            noteId: "note-1",
            title: "Note",
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            zIndex: 1,
            isFocused: false,
            state: "normal" as const,
            isDirty: false,
          },
          {
            id: "file-1",
            kind: "file" as const,
            title: "index.ts",
            x: 40,
            y: 50,
            width: 500,
            height: 320,
            zIndex: 2,
            isFocused: true,
            state: "normal" as const,
            filePath: "/repo/index.ts",
            isDirty: false,
          },
        ],
        nextZIndex: 3,
        focusedWindowId: "file-1",
        zoom: 0.9,
        panX: 0,
        panY: 0,
      },
      threadConversations: new Map(),
      fileContents: new Map(),
      noteContents: new Map(),
    };

    const focused = focusWorkspaceSessionWindow(session, "note-1");
    const moved = moveWorkspaceSessionWindow(focused, "note-1", 100, 120);
    const resized = resizeWorkspaceSessionWindow(moved, "note-1", 640, 480);
    const updated = updateWorkspaceSessionWindow(resized, "note-1", {
      title: "Renamed note",
    });
    const dirtied = setWorkspaceSessionDirty(updated, "note-1", true);
    const zoomed = setWorkspaceSessionZoom(dirtied, 5);
    const zoomedIn = zoomWorkspaceSessionIn(zoomed);
    const zoomedOut = zoomWorkspaceSessionOut(zoomedIn);
    const panned = setWorkspaceSessionPan(zoomedOut, 12, -8);
    const reordered = reorderWorkspaceSessionWindows(panned, 0, 1);
    const reset = resetWorkspaceSessionZoom(reordered);

    expect(session.layout.focusedWindowId).toBe("file-1");
    expect(session.layout.windows[0]?.x).toBe(10);
    expect(session.layout.windows[0]?.width).toBe(300);
    expect(session.layout.windows[0]?.title).toBe("Note");
    expect(session.layout.windows[0]?.isDirty).toBe(false);
    expect(session.layout.zoom).toBe(0.9);

    expect(focused.layout.focusedWindowId).toBe("note-1");
    expect(focused.layout.windows[0]?.isFocused).toBe(true);
    expect(moved.layout.windows[0]).toMatchObject({ x: 100, y: 120 });
    expect(resized.layout.windows[0]).toMatchObject({
      width: 640,
      height: 480,
    });
    expect(updated.layout.windows[0]?.title).toBe("Renamed note");
    expect(dirtied.layout.windows[0]?.isDirty).toBe(true);
    expect(zoomed.layout.zoom).toBe(3);
    expect(zoomedIn.layout.zoom).toBe(3);
    expect(zoomedOut.layout.zoom).toBe(2.9);
    expect(panned.layout.panX).toBe(12);
    expect(panned.layout.panY).toBe(-8);
    expect(reordered.layout.windows.map((window) => window.id)).toEqual([
      "file-1",
      "note-1",
    ]);
    expect(reset.layout.zoom).toBe(0.9);
    expect(reset.layout.panX).toBe(0);
    expect(reset.layout.panY).toBe(0);
  });

  it("clears the layout back to the initial window state", () => {
    const session = {
      ...createEmptyWorkspaceSession("wt-1"),
      layout: {
        ...createEmptyWorkspaceSession("wt-1").layout,
        windows: [
          {
            id: "note-1",
            kind: "note" as const,
            noteId: "note-1",
            title: "Note",
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            zIndex: 1,
            isFocused: true,
            state: "normal" as const,
            isDirty: true,
          },
        ],
        nextZIndex: 9,
        focusedWindowId: "note-1",
        zoom: 1.5,
        panX: 10,
        panY: 15,
      },
      threadConversations: new Map(),
      fileContents: new Map(),
      noteContents: new Map(),
    };

    const cleared = clearWorkspaceSessionWindows(session);

    expect(cleared).not.toBe(session);
    expect(cleared.layout).toEqual(createEmptyWorkspaceSession("wt-1").layout);
    expect(session.layout.windows).toHaveLength(1);
    expect(session.layout.focusedWindowId).toBe("note-1");
  });
});
