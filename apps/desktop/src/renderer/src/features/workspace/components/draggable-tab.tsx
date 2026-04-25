import { cn } from "@pi-desktop/ui";
import * as React from "react";

export interface DraggableTabProps {
  index: number;
  totalTabs: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

const DRAG_DATA_KEY = "application/draggable-tab-index";

export function DraggableTab({
  index,
  totalTabs,
  onReorder,
  children,
  className,
  isActive,
}: DraggableTabProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const draggable = totalTabs > 1;

  const handleDragStart = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DRAG_DATA_KEY, String(index));
      e.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
    },
    [index],
  );

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
    setIsDragOver(false);
  }, []);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [isDragOver],
  );

  const handleDragLeave = React.useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const fromIndexStr = e.dataTransfer.getData(DRAG_DATA_KEY);
      const fromIndex = Number(fromIndexStr);
      if (!Number.isNaN(fromIndex) && fromIndex !== index) {
        onReorder(fromIndex, index);
      }
    },
    [index, onReorder],
  );

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      onDragOver={draggable ? handleDragOver : undefined}
      onDragLeave={draggable ? handleDragLeave : undefined}
      onDrop={draggable ? handleDrop : undefined}
      className={cn(
        "transition-opacity duration-150",
        isDragging && "opacity-40",
        isDragOver && "border-l-2 border-l-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}
