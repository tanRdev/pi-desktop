import type { ChatThreadTurn } from "./chat-thread-turns";

/**
 * Pure windowing math for the virtualized conversation transcript
 * (issue #11). The transcript mounts only the turns near the viewport,
 * plus the active (streaming) turn and any forced turn (e.g. a search
 * target), and replaces the skipped turns with spacers whose heights
 * come from this layout: measured heights when a turn has been mounted
 * before, deterministic estimates otherwise.
 */

/** Turns mounted when no scroll metrics are available yet (first paint). */
export const FALLBACK_MOUNTED_TURNS = 30;
/** Extra pixels rendered above and below the visible viewport. */
export const DEFAULT_OVERSCAN_PX = 1200;

const BASE_MESSAGE_HEIGHT = 72;
const LINE_HEIGHT = 22;
const CHARS_PER_LINE = 88;
const TOOL_MESSAGE_EXTRA_HEIGHT = 28;
const MAX_MESSAGE_HEIGHT = 720;
const MIN_TURN_HEIGHT = 48;

function estimateMessageHeight(text: string, isTool: boolean): number {
  const lines = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
  const height =
    BASE_MESSAGE_HEIGHT +
    (lines - 1) * LINE_HEIGHT +
    (isTool ? TOOL_MESSAGE_EXTRA_HEIGHT : 0);
  return Math.min(MAX_MESSAGE_HEIGHT, height);
}

/** Deterministic height estimate for a turn that has never been mounted. */
export function estimateTurnHeight(turn: ChatThreadTurn): number {
  let height = 0;
  if (turn.userMessage) {
    height += estimateMessageHeight(turn.userMessage.text, false);
  }
  for (const message of turn.messages) {
    height += estimateMessageHeight(message.text, message.role === "tool");
  }
  return Math.max(MIN_TURN_HEIGHT, height);
}

export interface TurnLayout {
  heights: number[];
  /** offsets[i] is the top of turn i relative to the list top. */
  offsets: number[];
  totalHeight: number;
}

export function computeTurnLayout(
  turns: ReadonlyArray<ChatThreadTurn>,
  measuredHeights?: ReadonlyMap<string, number>,
): TurnLayout {
  const heights: number[] = [];
  const offsets: number[] = [];
  let totalHeight = 0;
  for (const turn of turns) {
    const measured = measuredHeights?.get(turn.id);
    const height =
      measured !== undefined && Number.isFinite(measured) && measured > 0
        ? measured
        : estimateTurnHeight(turn);
    offsets.push(totalHeight);
    heights.push(height);
    totalHeight += height;
  }
  return { heights, offsets, totalHeight };
}

export interface ScrollAnchor {
  turnId: string;
  /** Pixels from the top of the anchored turn to the viewport top. */
  offsetWithinTurn: number;
}

/**
 * Capture the turn at the top of the viewport so the reading position can
 * be restored after heights change, streaming appends, or a thread switch.
 * `viewportTop` is relative to the list top (see computeTurnLayout).
 */
export function captureScrollAnchor(
  turns: ReadonlyArray<ChatThreadTurn>,
  layout: TurnLayout,
  viewportTop: number,
): ScrollAnchor | null {
  if (turns.length === 0) return null;
  const clampedTop = Math.max(0, viewportTop);
  for (let index = 0; index < turns.length; index += 1) {
    const offset = layout.offsets[index] ?? 0;
    const height = layout.heights[index] ?? 0;
    if (offset + height > clampedTop) {
      const turn = turns[index];
      if (!turn) return null;
      return {
        turnId: turn.id,
        offsetWithinTurn: Math.min(clampedTop - offset, height),
      };
    }
  }
  const last = turns[turns.length - 1];
  if (!last) return null;
  return {
    turnId: last.id,
    offsetWithinTurn: layout.heights[turns.length - 1] ?? 0,
  };
}

/**
 * Resolve a captured anchor against a (possibly changed) layout. Returns
 * the list-relative scroll top that puts the same turn content at the top
 * of the viewport, or null when the anchored turn no longer exists.
 */
export function resolveScrollAnchor(
  anchor: ScrollAnchor,
  turns: ReadonlyArray<ChatThreadTurn>,
  layout: TurnLayout,
): number | null {
  const index = turns.findIndex((turn) => turn.id === anchor.turnId);
  if (index === -1) return null;
  const offset = layout.offsets[index] ?? 0;
  const height = layout.heights[index] ?? 0;
  return offset + Math.min(anchor.offsetWithinTurn, height);
}

/** Index of the turn containing `messageId`, or -1 when absent. */
export function findTurnIndexForMessage(
  turns: ReadonlyArray<ChatThreadTurn>,
  messageId: string,
): number {
  return turns.findIndex(
    (turn) =>
      turn.userMessage?.id === messageId ||
      turn.messages.some((message) => message.id === messageId),
  );
}

export interface MountedTurnWindowInput {
  turnCount: number;
  layout: TurnLayout;
  /** List-relative viewport top, or null when not measured yet. */
  viewportTop: number | null;
  viewportHeight: number;
  overscanPx?: number;
  /** Turn that must always stay mounted (the streaming turn), or -1. */
  activeTurnIndex?: number;
  /** Turn that must be mounted so it can be revealed (search target), or -1. */
  forcedTurnIndex?: number;
  fallbackTurnCount?: number;
}

/**
 * The bounded set of turn indices to mount. With scroll metrics, this is
 * the visible range plus overscan; before metrics exist (first paint, or
 * no scroll container) it is the trailing window so the latest turns —
 * including the active one — are what render. The active and forced turns
 * are always included, even when scrolled far away from them.
 */
export function computeMountedTurnIndices(
  input: MountedTurnWindowInput,
): number[] {
  const { turnCount, layout } = input;
  if (turnCount === 0) return [];
  const mounted = new Set<number>();

  if (input.viewportTop === null) {
    const fallback = input.fallbackTurnCount ?? FALLBACK_MOUNTED_TURNS;
    const start = Math.max(0, turnCount - fallback);
    for (let index = start; index < turnCount; index += 1) {
      mounted.add(index);
    }
  } else {
    const overscan = input.overscanPx ?? DEFAULT_OVERSCAN_PX;
    const rangeTop = input.viewportTop - overscan;
    const rangeBottom = input.viewportTop + input.viewportHeight + overscan;
    for (let index = 0; index < turnCount; index += 1) {
      const offset = layout.offsets[index] ?? 0;
      const height = layout.heights[index] ?? 0;
      if (offset + height > rangeTop && offset < rangeBottom) {
        mounted.add(index);
      }
    }
    if (mounted.size === 0) {
      // Viewport sits past the end of the (shrunk) content: mount the
      // nearest turn so the list never renders blank.
      let nearest = turnCount - 1;
      for (let index = 0; index < turnCount; index += 1) {
        const offset = layout.offsets[index] ?? 0;
        const height = layout.heights[index] ?? 0;
        if (offset + height > input.viewportTop) {
          nearest = index;
          break;
        }
      }
      mounted.add(nearest);
    }
  }

  for (const extra of [input.activeTurnIndex, input.forcedTurnIndex]) {
    if (extra !== undefined && extra >= 0 && extra < turnCount) {
      mounted.add(extra);
    }
  }

  return Array.from(mounted).sort((a, b) => a - b);
}

export interface MountedSegment {
  startIndex: number;
  endIndex: number;
  /** Spacer height (px) that must precede this segment. */
  spacerBefore: number;
}

export interface MountedSegments {
  segments: MountedSegment[];
  /** Spacer height (px) after the last mounted turn. */
  trailingSpacer: number;
}

/** Group mounted indices into contiguous runs with their spacer heights. */
export function buildMountedSegments(
  indices: ReadonlyArray<number>,
  layout: TurnLayout,
): MountedSegments {
  const segments: MountedSegment[] = [];
  let previousEnd = -1;
  for (const index of indices) {
    const current = segments[segments.length - 1];
    if (current && index === current.endIndex + 1) {
      current.endIndex = index;
    } else {
      const offset = layout.offsets[index] ?? 0;
      const previousBottom =
        previousEnd === -1
          ? 0
          : (layout.offsets[previousEnd] ?? 0) +
            (layout.heights[previousEnd] ?? 0);
      segments.push({
        startIndex: index,
        endIndex: index,
        spacerBefore: Math.max(0, offset - previousBottom),
      });
    }
    previousEnd = index;
  }

  let trailingSpacer = 0;
  if (previousEnd !== -1) {
    const bottom =
      (layout.offsets[previousEnd] ?? 0) + (layout.heights[previousEnd] ?? 0);
    trailingSpacer = Math.max(0, layout.totalHeight - bottom);
  }
  return { segments, trailingSpacer };
}

/**
 * Scroll anchors remembered per thread so switching away and back restores
 * the reading position even though the thread panel remounts. Bounded with
 * least-recently-used eviction.
 */
export class ThreadScrollAnchorStore {
  private readonly anchors = new Map<string, ScrollAnchor>();
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  get size(): number {
    return this.anchors.size;
  }

  get(threadId: string): ScrollAnchor | null {
    const anchor = this.anchors.get(threadId);
    if (!anchor) return null;
    this.anchors.delete(threadId);
    this.anchors.set(threadId, anchor);
    return anchor;
  }

  set(threadId: string, anchor: ScrollAnchor): void {
    this.anchors.delete(threadId);
    this.anchors.set(threadId, anchor);
    while (this.anchors.size > this.maxEntries) {
      const oldest = this.anchors.keys().next().value;
      if (oldest === undefined) break;
      this.anchors.delete(oldest);
    }
  }

  delete(threadId: string): void {
    this.anchors.delete(threadId);
  }
}

/** Shared store: module scope so it survives per-thread panel remounts. */
export const threadScrollAnchorStore = new ThreadScrollAnchorStore();

/** Nearest ancestor (exclusive) that scrolls vertically, if any. */
export function findScrollContainer(start: HTMLElement): HTMLElement | null {
  let element = start.parentElement;
  while (element) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

/**
 * Viewport top relative to the content element's top, in the same
 * coordinate space as computeTurnLayout offsets.
 */
export function getRelativeViewportTop(
  container: HTMLElement,
  content: HTMLElement,
): number {
  return (
    container.getBoundingClientRect().top - content.getBoundingClientRect().top
  );
}
