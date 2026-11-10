import * as React from "react";
import type { ChatThreadTurn } from "./chat-thread-turns";
import {
  captureScrollAnchor,
  computeTurnLayout,
  findScrollContainer,
  getRelativeViewportTop,
  resolveScrollAnchor,
  type ScrollAnchor,
  type TurnLayout,
  threadScrollAnchorStore,
} from "./virtual-turn-window";

export interface ViewportMetrics {
  top: number;
  height: number;
}

export interface VirtualTurnListScroll {
  rootRef: React.RefObject<HTMLDivElement | null>;
  registerRow: (turnId: string) => (element: HTMLDivElement | null) => void;
  metrics: ViewportMetrics | null;
  layout: TurnLayout;
}

/**
 * Scroll/measurement engine for the virtualized transcript (issue #11).
 *
 * - Discovers the surrounding scroll container and tracks the viewport in
 *   list-relative coordinates.
 * - Measures mounted turn heights with a ResizeObserver; the layout falls
 *   back to estimates for turns that have never been mounted.
 * - Anchors the reading position to the turn at the viewport top: when a
 *   height correction above the anchor shifts its offset, scrollTop is
 *   adjusted by the same delta so the visible content does not jump.
 * - Saves the anchor per thread (module-level store) and restores it when
 *   the list remounts after a thread switch.
 */
export function useVirtualTurnListScroll(
  turns: ChatThreadTurn[],
  scrollStoreKey: string | null | undefined,
): VirtualTurnListScroll {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLElement | null>(null);
  const rowElementsRef = React.useRef(new Map<string, HTMLDivElement>());
  const rowCallbacksRef = React.useRef(
    new Map<string, (element: HTMLDivElement | null) => void>(),
  );
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const anchorRef = React.useRef<ScrollAnchor | null>(null);
  const anchorOffsetRef = React.useRef<number | null>(null);
  const atBottomRef = React.useRef(true);
  const restoredKeyRef = React.useRef<string | null>(null);
  const storeKeyRef = React.useRef(scrollStoreKey);
  storeKeyRef.current = scrollStoreKey;

  const [measuredHeights, setMeasuredHeights] = React.useState<
    ReadonlyMap<string, number>
  >(() => new Map());
  const [metrics, setMetrics] = React.useState<ViewportMetrics | null>(null);

  const layout = React.useMemo(
    () => computeTurnLayout(turns, measuredHeights),
    [turns, measuredHeights],
  );
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;
  const turnsRef = React.useRef(turns);
  turnsRef.current = turns;

  const measureRow = React.useCallback((entries: ResizeObserverEntry[]) => {
    setMeasuredHeights((previous) => {
      let next: Map<string, number> | null = null;
      for (const entry of entries) {
        const element = entry.target as HTMLDivElement;
        const turnId = element.dataset.turnId;
        if (!turnId) continue;
        const height = Math.round(entry.contentRect.height);
        if (height > 0 && previous.get(turnId) !== height) {
          next ??= new Map(previous);
          next.set(turnId, height);
        }
      }
      return next ?? previous;
    });
  }, []);

  const registerRow = React.useCallback((turnId: string) => {
    const cached = rowCallbacksRef.current.get(turnId);
    if (cached) return cached;
    const callback = (element: HTMLDivElement | null) => {
      const existing = rowElementsRef.current.get(turnId);
      if (existing && existing !== element) {
        resizeObserverRef.current?.unobserve(existing);
        rowElementsRef.current.delete(turnId);
      }
      if (element) {
        rowElementsRef.current.set(turnId, element);
        resizeObserverRef.current?.observe(element);
      }
    };
    rowCallbacksRef.current.set(turnId, callback);
    return callback;
  }, []);

  const hasTurns = turns.length > 0;

  // Discover the scroll container, track viewport metrics, and restore
  // the saved anchor for this thread on mount.
  React.useEffect(() => {
    if (!hasTurns) return;
    const root = rootRef.current;
    if (!root) return;
    if (typeof ResizeObserver !== "undefined" && !resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(measureRow);
      for (const element of rowElementsRef.current.values()) {
        resizeObserverRef.current.observe(element);
      }
    }
    const container = findScrollContainer(root);
    containerRef.current = container;
    if (!container) return;

    let frame = 0;
    const updateMetrics = () => {
      frame = 0;
      const top = getRelativeViewportTop(container, root);
      const currentLayout = layoutRef.current;
      const currentTurns = turnsRef.current;
      anchorRef.current = captureScrollAnchor(currentTurns, currentLayout, top);
      anchorOffsetRef.current = anchorRef.current
        ? resolveScrollAnchor(anchorRef.current, currentTurns, currentLayout)
        : null;
      atBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <=
        2;
      const key = storeKeyRef.current;
      if (key) {
        if (atBottomRef.current || !anchorRef.current) {
          threadScrollAnchorStore.delete(key);
        } else {
          threadScrollAnchorStore.set(key, anchorRef.current);
        }
      }
      setMetrics((previous) =>
        previous &&
        Math.abs(previous.top - top) < 1 &&
        previous.height === container.clientHeight
          ? previous
          : { top, height: container.clientHeight },
      );
    };
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateMetrics);
    };
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const key = storeKeyRef.current ?? null;
    const saved = key ? threadScrollAnchorStore.get(key) : null;
    if (saved && restoredKeyRef.current !== key) {
      restoredKeyRef.current = key;
      const resolved = resolveScrollAnchor(
        saved,
        turnsRef.current,
        layoutRef.current,
      );
      if (resolved !== null) {
        // Two frames: let the stick-to-bottom container finish its
        // initial jump before applying the restored position.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const rootOffset =
              container.scrollTop - getRelativeViewportTop(container, root);
            container.scrollTop = rootOffset + resolved;
            scheduleUpdate();
          });
        });
      }
    } else {
      scheduleUpdate();
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      container.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [measureRow, hasTurns]);

  // Save the anchor when the list unmounts (thread switch remounts it).
  React.useEffect(() => {
    return () => {
      const key = storeKeyRef.current;
      if (!key) return;
      if (atBottomRef.current || !anchorRef.current) {
        threadScrollAnchorStore.delete(key);
      } else {
        threadScrollAnchorStore.set(key, anchorRef.current);
      }
    };
  }, []);

  // Height corrections above the anchor turn shift its offset; compensate
  // scrollTop by the same delta so the reading position does not jump.
  React.useEffect(() => {
    const container = containerRef.current;
    const anchor = anchorRef.current;
    if (!container || !anchor || atBottomRef.current) return;
    const resolved = resolveScrollAnchor(anchor, turns, layout);
    if (resolved === null || anchorOffsetRef.current === null) return;
    const delta = resolved - anchorOffsetRef.current;
    anchorOffsetRef.current = resolved;
    if (delta !== 0) {
      container.scrollTop += delta;
    }
  }, [layout, turns]);

  return { rootRef, registerRow, metrics, layout };
}
