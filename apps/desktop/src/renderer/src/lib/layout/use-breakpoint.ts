import { useEffect, useRef, useState } from "react";

import { type BreakpointKey, getBreakpointForWidth } from "./breakpoints";

export interface UseBreakpointResult {
  width: number;
  height: number;
  current: BreakpointKey;
  isSm: boolean;
  isMd: boolean;
  isLg: boolean;
  isXl: boolean;
}

const DEBOUNCE_MS = 150;

export function useBreakpoint(): UseBreakpointResult {
  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
    width:
      typeof document !== "undefined"
        ? document.documentElement.clientWidth
        : 0,
    height:
      typeof document !== "undefined"
        ? document.documentElement.clientHeight
        : 0,
  }));

  const [current, setCurrent] = useState<BreakpointKey>(() =>
    getBreakpointForWidth(size.width),
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const el = document.documentElement;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;

        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          setSize({ width: Math.round(w), height: Math.round(h) });
          timerRef.current = null;
        }, DEBOUNCE_MS);
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const nextBp = getBreakpointForWidth(size.width);

  useEffect(() => {
    if (nextBp !== current) {
      setCurrent(nextBp);
    }
  }, [nextBp, current]);

  const isSm = current === "sm";
  const isMd = current === "md";
  const isLg = current === "lg";
  const isXl = current === "xl" || current === "2xl";

  return {
    width: size.width,
    height: size.height,
    current,
    isSm,
    isMd,
    isLg,
    isXl,
  };
}
