import type { AgentMessageSnapshot } from "@pi-desktop/shared";
import { describe, expect, it } from "vitest";
import { buildChatTurns, type ChatThreadTurn } from "./chat-thread-turns";
import {
  buildMountedSegments,
  captureScrollAnchor,
  computeMountedTurnIndices,
  computeTurnLayout,
  estimateTurnHeight,
  FALLBACK_MOUNTED_TURNS,
  findTurnIndexForMessage,
  resolveScrollAnchor,
  ThreadScrollAnchorStore,
} from "./virtual-turn-window";

function createTurns(count: number): ChatThreadTurn[] {
  const messages: AgentMessageSnapshot[] = [];
  for (let index = 0; index < count; index += 1) {
    messages.push({
      id: `user-${index}`,
      role: "user",
      text: `Question ${index}`,
      status: "complete",
      timestamp: index * 2,
    });
    messages.push({
      id: `assistant-${index}`,
      role: "assistant",
      text: `Answer ${index}`,
      status: "complete",
      timestamp: index * 2 + 1,
    });
  }
  return buildChatTurns(messages);
}

describe("computeTurnLayout", () => {
  it("produces cumulative offsets and prefers measured heights", () => {
    const turns = createTurns(3);
    const estimated = computeTurnLayout(turns);
    expect(estimated.offsets[0]).toBe(0);
    expect(estimated.offsets[1]).toBe(estimated.heights[0]);
    expect(estimated.totalHeight).toBe(
      estimated.heights.reduce((sum, height) => sum + height, 0),
    );

    const measured = computeTurnLayout(
      turns,
      new Map([[turns[1]?.id ?? "", 500]]),
    );
    expect(measured.heights[1]).toBe(500);
    expect(measured.offsets[2]).toBe((measured.heights[0] ?? 0) + 500);
    expect(estimateTurnHeight(turns[0] as ChatThreadTurn)).toBeGreaterThan(0);
  });
});

describe("computeMountedTurnIndices", () => {
  it("bounds mounted rows for a 2000-turn fixture at the top", () => {
    const turns = createTurns(2000);
    const layout = computeTurnLayout(turns);

    const mounted = computeMountedTurnIndices({
      turnCount: turns.length,
      layout,
      viewportTop: 0,
      viewportHeight: 800,
    });

    expect(mounted.length).toBeLessThan(40);
    expect(mounted[0]).toBe(0);
    expect(mounted).not.toContain(1000);
  });

  it("mounts a bounded window around a mid-history viewport", () => {
    const turns = createTurns(2000);
    const layout = computeTurnLayout(turns);
    const middleTop = layout.offsets[1000] ?? 0;

    const mounted = computeMountedTurnIndices({
      turnCount: turns.length,
      layout,
      viewportTop: middleTop,
      viewportHeight: 800,
    });

    expect(mounted.length).toBeLessThan(60);
    expect(mounted).toContain(1000);
    expect(mounted).not.toContain(0);
    expect(mounted).not.toContain(1999);
  });

  it("always retains the active turn and a forced (search) turn", () => {
    const turns = createTurns(2000);
    const layout = computeTurnLayout(turns);

    const mounted = computeMountedTurnIndices({
      turnCount: turns.length,
      layout,
      viewportTop: 0,
      viewportHeight: 800,
      activeTurnIndex: 1999,
      forcedTurnIndex: 42,
    });

    expect(mounted).toContain(1999);
    expect(mounted).toContain(42);
    expect(mounted.length).toBeLessThan(42);
  });

  it("falls back to a bounded trailing window before metrics exist", () => {
    const turns = createTurns(2000);
    const layout = computeTurnLayout(turns);

    const mounted = computeMountedTurnIndices({
      turnCount: turns.length,
      layout,
      viewportTop: null,
      viewportHeight: 0,
    });

    expect(mounted).toHaveLength(FALLBACK_MOUNTED_TURNS);
    expect(mounted[0]).toBe(2000 - FALLBACK_MOUNTED_TURNS);
    expect(mounted[mounted.length - 1]).toBe(1999);
  });
});

describe("buildMountedSegments", () => {
  it("accounts for every pixel of the total height exactly once", () => {
    const turns = createTurns(100);
    const layout = computeTurnLayout(turns);
    const mounted = computeMountedTurnIndices({
      turnCount: turns.length,
      layout,
      viewportTop: 0,
      viewportHeight: 800,
      activeTurnIndex: 99,
      forcedTurnIndex: 50,
    });

    const { segments, trailingSpacer } = buildMountedSegments(mounted, layout);
    const mountedHeight = mounted.reduce(
      (sum, index) => sum + (layout.heights[index] ?? 0),
      0,
    );
    const spacerHeight =
      segments.reduce((sum, segment) => sum + segment.spacerBefore, 0) +
      trailingSpacer;

    expect(segments.length).toBeGreaterThan(1);
    expect(mountedHeight + spacerHeight).toBe(layout.totalHeight);
  });
});

describe("scroll anchors", () => {
  it("round-trips the reading position through a layout change", () => {
    const turns = createTurns(100);
    const layout = computeTurnLayout(turns);
    const viewportTop = (layout.offsets[40] ?? 0) + 10;

    const anchor = captureScrollAnchor(turns, layout, viewportTop);
    expect(anchor?.turnId).toBe(turns[40]?.id);
    if (!anchor) throw new Error("expected a scroll anchor");
    expect(resolveScrollAnchor(anchor, turns, layout)).toBe(viewportTop);

    // Simulate turns above the anchor measuring taller than estimated:
    // the resolved position shifts by exactly the growth above it.
    const grown = computeTurnLayout(
      turns,
      new Map([[turns[10]?.id ?? "", (layout.heights[10] ?? 0) + 250]]),
    );
    expect(resolveScrollAnchor(anchor, turns, grown)).toBe(viewportTop + 250);
  });

  it("returns null when the anchored turn is gone", () => {
    const turns = createTurns(10);
    const layout = computeTurnLayout(turns);
    const anchor = captureScrollAnchor(turns, layout, 0);
    if (!anchor) throw new Error("expected a scroll anchor");
    expect(resolveScrollAnchor(anchor, [], layout)).toBeNull();
  });
});

describe("findTurnIndexForMessage", () => {
  it("finds turns by user and assistant message ids", () => {
    const turns = createTurns(10);
    expect(findTurnIndexForMessage(turns, "user-7")).toBe(7);
    expect(findTurnIndexForMessage(turns, "assistant-3")).toBe(3);
    expect(findTurnIndexForMessage(turns, "missing")).toBe(-1);
  });
});

describe("ThreadScrollAnchorStore", () => {
  it("stores, returns, deletes, and evicts least-recently-used anchors", () => {
    const store = new ThreadScrollAnchorStore(2);
    store.set("thread-a", { turnId: "turn-1", offsetWithinTurn: 5 });
    store.set("thread-b", { turnId: "turn-2", offsetWithinTurn: 0 });
    expect(store.get("thread-a")?.turnId).toBe("turn-1");

    // thread-a was just read, so thread-b is the eviction victim.
    store.set("thread-c", { turnId: "turn-3", offsetWithinTurn: 0 });
    expect(store.size).toBe(2);
    expect(store.get("thread-b")).toBeNull();
    expect(store.get("thread-a")?.turnId).toBe("turn-1");

    store.delete("thread-a");
    expect(store.get("thread-a")).toBeNull();
  });
});
