import { cn } from "@pi-desktop/ui";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { SplitOrientation } from "./split-pane";
import { SplitPane } from "./split-pane";

interface SplitPaneGroupContextValue {
  focusedPaneId: string | null;
  setFocusedPaneId: (id: string | null) => void;
  registerPane: (id: string) => void;
  unregisterPane: (id: string) => void;
}

const SplitPaneGroupContext = createContext<SplitPaneGroupContextValue | null>(
  null,
);

function useSplitPaneGroup(): SplitPaneGroupContextValue | null {
  return useContext(SplitPaneGroupContext);
}

interface SplitPaneGroupProps {
  orientation?: SplitOrientation;
  className?: string;
  children: React.ReactNode;
}

function SplitPaneGroup({
  orientation = "horizontal",
  className,
  children,
}: SplitPaneGroupProps) {
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const registeredPanes = useRef(new Set<string>());

  const registerPane = useCallback((id: string) => {
    registeredPanes.current.add(id);
  }, []);

  const unregisterPane = useCallback(
    (id: string) => {
      registeredPanes.current.delete(id);
      if (focusedPaneId === id) {
        setFocusedPaneId(null);
      }
    },
    [focusedPaneId],
  );

  return (
    <SplitPaneGroupContext.Provider
      value={{ focusedPaneId, setFocusedPaneId, registerPane, unregisterPane }}
    >
      <div
        data-slot="split-pane-group"
        data-orientation={orientation}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 overflow-hidden",
          orientation === "vertical" ? "flex-col" : "flex-row",
          className,
        )}
      >
        {children}
      </div>
    </SplitPaneGroupContext.Provider>
  );
}

interface SplitPaneItemProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

function SplitPaneItem({ id, className, children }: SplitPaneItemProps) {
  const ctx = useSplitPaneGroup();
  const isFocused = ctx?.focusedPaneId === id;

  return (
    <div
      data-slot="split-pane-item"
      data-pane-id={id}
      data-focused={isFocused ? "true" : undefined}
      className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      onFocus={() => ctx?.setFocusedPaneId(id)}
    >
      {children}
    </div>
  );
}

interface NestedSplitPaneProps {
  id: string;
  orientation?: SplitOrientation;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  persistenceKey?: string;
  onResize?: (size: number) => void;
  className?: string;
  children: [React.ReactNode, React.ReactNode];
}

function NestedSplitPane({
  id,
  orientation = "horizontal",
  defaultSize,
  minSize,
  maxSize,
  persistenceKey,
  onResize,
  className,
  children,
}: NestedSplitPaneProps) {
  const ctx = useSplitPaneGroup();
  const isFocused = ctx?.focusedPaneId === id;

  return (
    <div
      data-slot="nested-split-pane"
      data-pane-id={id}
      data-focused={isFocused ? "true" : undefined}
      className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      onFocus={() => ctx?.setFocusedPaneId(id)}
    >
      <SplitPane
        orientation={orientation}
        defaultSize={defaultSize}
        minSize={minSize}
        maxSize={maxSize}
        persistenceKey={persistenceKey}
        onResize={onResize}
      >
        {children}
      </SplitPane>
    </div>
  );
}

export { SplitPaneGroup, SplitPaneItem, NestedSplitPane, useSplitPaneGroup };
