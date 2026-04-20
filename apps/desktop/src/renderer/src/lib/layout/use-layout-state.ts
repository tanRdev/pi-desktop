import { useCallback, useEffect, useRef, useState } from "react";

import type { BreakpointKey } from "./breakpoints";
import { useBreakpoint } from "./use-breakpoint";

const STORAGE_PREFIX = "pi-desktop:layout:";

interface LayoutState {
  sidebarCollapsed: boolean;
  panelSizes: Record<string, number>;
}

interface UseLayoutStateResult {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  panelSizes: Record<string, number>;
  setPanelSize: (panelId: string, size: number) => void;
}

function storageKey(bp: BreakpointKey): string {
  return `${STORAGE_PREFIX}${bp}`;
}

function defaultState(): LayoutState {
  return { sidebarCollapsed: false, panelSizes: {} };
}

function loadState(bp: BreakpointKey): LayoutState {
  try {
    const raw = localStorage.getItem(storageKey(bp));
    if (raw == null) return defaultState();
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaultState();
    return {
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === "boolean"
          ? parsed.sidebarCollapsed
          : false,
      panelSizes:
        typeof parsed.panelSizes === "object" && parsed.panelSizes !== null
          ? parsed.panelSizes
          : {},
    };
  } catch {
    return defaultState();
  }
}

function saveState(bp: BreakpointKey, state: LayoutState): void {
  try {
    localStorage.setItem(storageKey(bp), JSON.stringify(state));
  } catch {
    // localStorage may be unavailable
  }
}

export function useLayoutState(): UseLayoutStateResult {
  const { current } = useBreakpoint();
  const prevBpRef = useRef<BreakpointKey>(current);

  const [state, setState] = useState<LayoutState>(() => loadState(current));

  useEffect(() => {
    if (current !== prevBpRef.current) {
      prevBpRef.current = current;
      setState(loadState(current));
    }
  }, [current]);

  const toggleSidebar = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, sidebarCollapsed: !prev.sidebarCollapsed };
      saveState(current, next);
      return next;
    });
  }, [current]);

  const setPanelSize = useCallback(
    (panelId: string, size: number) => {
      setState((prev) => {
        const next = {
          ...prev,
          panelSizes: { ...prev.panelSizes, [panelId]: size },
        };
        saveState(current, next);
        return next;
      });
    },
    [current],
  );

  return {
    sidebarCollapsed: state.sidebarCollapsed,
    toggleSidebar,
    panelSizes: state.panelSizes,
    setPanelSize,
  };
}
