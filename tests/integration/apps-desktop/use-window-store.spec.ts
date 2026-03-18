import { describe, expect, it } from "vitest";
import {
  createWindowStoreSnapshotCache,
  type WindowStoreState,
} from "../../../apps/desktop/src/renderer/src/hooks/use-window-store";
import { createEmptyWorkspaceSession } from "../../../packages/shared/src";

describe("use-window-store snapshot stability", () => {
  it("reuses the previous snapshot when layout and ui references are unchanged", () => {
    const cache = createWindowStoreSnapshotCache();
    const session = createEmptyWorkspaceSession("/tmp/repo-a");

    const firstSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });
    const secondSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(secondSnapshot).toBe(firstSnapshot);
  });

  it("returns a new snapshot when any subscribed reference changes", () => {
    const cache = createWindowStoreSnapshotCache();
    const session = createEmptyWorkspaceSession("/tmp/repo-a");

    const firstSnapshot = cache.getSnapshot({
      layout: session.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    const nextSnapshot = cache.getSnapshot({
      layout: {
        ...session.layout,
        windows: [...session.layout.windows],
      },
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(nextSnapshot).not.toBe(firstSnapshot);
  });

  it("reuses the same fallback layout snapshot across unchanged empty states", () => {
    const cache = createWindowStoreSnapshotCache();

    const firstSnapshot = cache.getSnapshot({
      layout: {
        windows: [],
        nextZIndex: 1,
        focusedWindowId: null,
        snapGridSize: 16,
      },
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });
    const secondSnapshot = cache.getSnapshot({
      layout: firstSnapshot.layout,
      draggingWindowId: null,
      resizingWindowId: null,
      snapPreview: null,
    });

    expect(secondSnapshot).toBe(firstSnapshot);
  });
});

type _WindowStoreState = WindowStoreState;
void (0 as unknown as _WindowStoreState);
