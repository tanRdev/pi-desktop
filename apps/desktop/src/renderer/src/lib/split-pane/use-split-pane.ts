import { useCallback, useRef, useState } from "react";

const STORAGE_PREFIX = "pi-desktop:split-pane:";
const KEYBOARD_STEP = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

function loadSize(id: string): number | undefined {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw == null) return undefined;
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function saveSize(id: string, size: number): void {
  try {
    localStorage.setItem(storageKey(id), String(size));
  } catch {
    // localStorage may be unavailable (SSR, quota)
  }
}

interface UseSplitPaneOptions {
  id: string;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  direction?: "horizontal" | "vertical";
  onResize?: (size: number) => void;
}

interface UseSplitPaneReturn {
  size: number;
  isDragging: boolean;
  setSize: (next: number) => void;
  resetToDefault: () => void;
  handleDragStart: () => void;
  handleDragMove: (
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
  ) => void;
  handleDragEnd: () => void;
  handleKeyDown: (key: string) => void;
}

function useSplitPane({
  id,
  defaultSize,
  minSize,
  maxSize,
  direction = "horizontal",
  onResize,
}: UseSplitPaneOptions): UseSplitPaneReturn {
  const clampedDefault = clamp(defaultSize, minSize, maxSize);
  const persisted = loadSize(id);
  const [size, setSizeRaw] = useState(
    persisted != null ? clamp(persisted, minSize, maxSize) : clampedDefault,
  );
  const [isDragging, setIsDragging] = useState(false);
  const defaultRef = useRef(clampedDefault);

  const setSize = useCallback(
    (next: number) => {
      const clamped = clamp(next, minSize, maxSize);
      setSizeRaw(clamped);
      saveSize(id, clamped);
      onResize?.(clamped);
    },
    [id, minSize, maxSize, onResize],
  );

  const resetToDefault = useCallback(() => {
    const clamped = clamp(defaultRef.current, minSize, maxSize);
    setSizeRaw(clamped);
    saveSize(id, clamped);
    onResize?.(clamped);
  }, [id, minSize, maxSize, onResize]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback(
    (clientX: number, clientY: number, containerRect: DOMRect) => {
      const isVertical = direction === "vertical";
      const total = isVertical ? containerRect.height : containerRect.width;
      if (total <= 0) return;
      const offset = isVertical
        ? clientY - containerRect.top
        : clientX - containerRect.left;
      const percent = (offset / total) * 100;
      setSize(percent);
    },
    [direction, setSize],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (key: string) => {
      const isVertical = direction === "vertical";
      let delta = 0;
      if (!isVertical) {
        if (key === "ArrowLeft") delta = -KEYBOARD_STEP;
        if (key === "ArrowRight") delta = KEYBOARD_STEP;
      } else {
        if (key === "ArrowUp") delta = -KEYBOARD_STEP;
        if (key === "ArrowDown") delta = KEYBOARD_STEP;
      }
      if (delta !== 0) {
        setSize(size + delta);
      }
      if (key === "Enter") {
        resetToDefault();
      }
    },
    [direction, size, setSize, resetToDefault],
  );

  return {
    size,
    isDragging,
    setSize,
    resetToDefault,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleKeyDown,
  };
}

export { useSplitPane };
export type { UseSplitPaneOptions, UseSplitPaneReturn };
