"use client";

import { Chat, Plus } from "@phosphor-icons/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";

interface LineSelection {
  startLine: number;
  endLine: number;
}

interface DragState {
  isDragging: boolean;
  startLine: number;
  currentLine: number;
}

interface CodeLineViewerProps {
  code: string;
  language: string;
  filename: string;
  filePath: string;
  onAddToChat?: (selection: {
    text: string;
    startLine: number;
    endLine: number;
    filename: string;
    filePath: string;
  }) => void;
  className?: string;
}

export function CodeLineViewer({
  code,
  language,
  filename,
  filePath,
  onAddToChat,
  className,
}: CodeLineViewerProps) {
  const lines = code.split("\n");
  const lineCount = lines.length;
  const lineNumberWidth = String(lineCount).length * 0.6 + 1.5;

  const [selection, setSelection] = React.useState<LineSelection | null>(null);
  const [hoveredLine, setHoveredLine] = React.useState<number | null>(null);
  const [showPopover, setShowPopover] = React.useState(false);
  const [popoverPosition, setPopoverPosition] = React.useState({
    top: 0,
    left: 0,
  });
  const [dragState, setDragState] = React.useState<DragState | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lineRefsRef = React.useRef<Map<number, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const popover = containerRef.current?.querySelector('[class*="z-20"]');
      if (popover?.contains(e.target as Node)) return;

      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setSelection(null);
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (selection) {
      if (popoverTimeoutRef.current) {
        clearTimeout(popoverTimeoutRef.current);
      }
      popoverTimeoutRef.current = setTimeout(() => {
        setShowPopover(true);
      }, 100);
    } else {
      setShowPopover(false);
    }
    return () => {
      if (popoverTimeoutRef.current) {
        clearTimeout(popoverTimeoutRef.current);
      }
    };
  }, [selection]);

  React.useEffect(() => {
    if (!dragState?.isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const currentDrag = dragState;
      if (!currentDrag?.isDragging) return;
      const target = e.target as HTMLElement;
      const lineRow = target.closest(".line-row");
      if (lineRow) {
        const lineNumber = parseInt(
          lineRow.getAttribute("data-line-number") || "0",
          10,
        );
        if (lineNumber && lineNumber !== currentDrag.currentLine) {
          const startLine = Math.min(currentDrag.startLine, lineNumber);
          const endLine = Math.max(currentDrag.startLine, lineNumber);
          setSelection({ startLine, endLine });
          setDragState((prev) =>
            prev ? { ...prev, currentLine: lineNumber } : null,
          );
        }
      }
    }

    function handleMouseUp(e: MouseEvent) {
      if (!dragState?.isDragging) return;

      const target = e.target as HTMLElement;
      const lineRow = target.closest(".line-row");
      if (lineRow) {
        const lineNumber = parseInt(
          lineRow.getAttribute("data-line-number") || "0",
          10,
        );
        if (lineNumber) {
          const startLine = Math.min(dragState.startLine, lineNumber);
          const endLine = Math.max(dragState.startLine, lineNumber);
          setSelection({ startLine, endLine });

          const midLine = Math.floor((startLine + endLine) / 2);
          const lineElement = lineRefsRef.current.get(midLine);
          if (lineElement && containerRef.current) {
            const rect = lineElement.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            setPopoverPosition({
              top: rect.bottom - containerRect.top,
              left: 60,
            });
          }
        }
      }

      setDragState(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  function handleMouseDown(lineNumber: number, e: React.MouseEvent) {
    e.preventDefault();
    setDragState({
      isDragging: true,
      startLine: lineNumber,
      currentLine: lineNumber,
    });
    setSelection({ startLine: lineNumber, endLine: lineNumber });
    setShowPopover(false);
  }

  function handleLineClick(lineNumber: number, e: React.MouseEvent) {
    e.stopPropagation();

    if (e.shiftKey && selection) {
      const startLine = Math.min(selection.startLine, lineNumber);
      const endLine = Math.max(selection.endLine, lineNumber);
      setSelection({ startLine, endLine });
    } else {
      if (
        selection?.startLine === lineNumber &&
        selection.endLine === lineNumber
      ) {
        setSelection(null);
        setShowPopover(false);
      } else {
        setSelection({ startLine: lineNumber, endLine: lineNumber });
      }
    }

    const lineElement = lineRefsRef.current.get(lineNumber);
    if (lineElement && containerRef.current) {
      const rect = lineElement.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.bottom - containerRect.top,
        left: 60,
      });
    }
  }

  function handleAddToChat() {
    if (!selection || !onAddToChat) return;

    const selectedText = lines
      .slice(selection.startLine - 1, selection.endLine)
      .join("\n");

    onAddToChat({
      text: selectedText,
      startLine: selection.startLine,
      endLine: selection.endLine,
      filename,
      filePath,
    });

    setSelection(null);
    setShowPopover(false);
  }

  function isLineSelected(lineNumber: number): boolean {
    if (!selection) return false;
    return lineNumber >= selection.startLine && lineNumber <= selection.endLine;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none",
        "animate-in fade-in duration-200 [transition-timing-function:var(--ease-out)]",
        className,
      )}
    >
      {/* Code with line numbers overlay */}
      <div className="flex">
        {/* Line numbers column */}
        <div
          className="sticky left-0 z-10 shrink-0 bg-[#0a0a0a]"
          style={{ width: `${lineNumberWidth}rem` }}
        >
          <div className="flex flex-col font-mono text-[13px] leading-relaxed">
            {lines.map((_, index) => {
              const lineNumber = index + 1;
              const isSelected = isLineSelected(lineNumber);
              const isHovered = hoveredLine === lineNumber;
              const isDragging = dragState?.isDragging;

              return (
                <div
                  key={lineNumber}
                  ref={(el) => {
                    if (el) lineRefsRef.current.set(lineNumber, el);
                  }}
                  data-line-number={lineNumber}
                  className={cn(
                    "line-row group relative flex h-[1.625rem] cursor-pointer items-center",
                    "transition-transform duration-150 [transition-timing-function:var(--ease-out)]",
                    "motion-reduce:transition-none",
                    isDragging && "cursor-grabbing",
                  )}
                  onMouseEnter={() => {
                    setHoveredLine(lineNumber);
                    if (dragState?.isDragging) {
                      const startLine = Math.min(
                        dragState.startLine,
                        lineNumber,
                      );
                      const endLine = Math.max(dragState.startLine, lineNumber);
                      setSelection({ startLine, endLine });
                    }
                  }}
                  onMouseLeave={() => {
                    if (!dragState?.isDragging) {
                      setHoveredLine(null);
                    }
                  }}
                  onMouseDown={(e) => handleMouseDown(lineNumber, e)}
                >
                  {/* Selection highlight */}
                  {isSelected && (
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 -left-4 right-0 bg-white/[0.04]",
                        "origin-left transition-all duration-200 [transition-timing-function:var(--ease-out)]",
                        "motion-reduce:transition-none",
                        "animate-in fade-in-50 scale-x-95 duration-200",
                      )}
                    />
                  )}

                  {/* Hover highlight */}
                  {isHovered && !isSelected && (
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 -left-4 right-0 bg-white/[0.02]",
                        "origin-left transition-all duration-200 [transition-timing-function:var(--ease-out)]",
                        "motion-reduce:transition-none",
                        "animate-in fade-in-50 scale-x-95 duration-200",
                      )}
                    />
                  )}

                  {/* Plus button - always visible on hover or selection */}
                  <button
                    type="button"
                    onClick={(e) => handleLineClick(lineNumber, e)}
                    className={cn(
                      "absolute left-0 flex size-5 items-center justify-center rounded text-white/30",
                      "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
                      "hover:scale-110 hover:-translate-y-[1px]",
                      "active:scale-[0.97] motion-reduce:active:scale-100",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/[0.08]",
                      "motion-reduce:transform-none motion-reduce:transition-none",
                      isHovered || isSelected
                        ? "opacity-100 hover:bg-white/[0.06] hover:text-white/80"
                        : "opacity-0 scale-95",
                    )}
                    aria-label={`Select line ${lineNumber}`}
                  >
                    <Plus className="size-3.5" />
                  </button>

                  {/* Line number */}
                  <span
                    className={cn(
                      "ml-5 text-right text-xs",
                      "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
                      isSelected
                        ? "text-primary font-medium translate-x-[2px]"
                        : "text-white/30 hover:text-white/50",
                    )}
                    style={{ width: `${lineNumberWidth - 1.5}rem` }}
                  >
                    {lineNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Code content */}
        <div className="relative min-w-0 flex-1 overflow-x-auto">
          <CodeBlockCode
            code={code}
            language={language}
            className="min-h-full"
          />
        </div>
      </div>

      {/* Popover */}
      {showPopover && selection && (
        <div
          className={cn(
            "absolute z-50",
            "animate-in fade-in-0 slide-in-from-top-1 zoom-in-95 duration-200 [transition-timing-function:var(--ease-out)]",
            "motion-reduce:animate-none",
          )}
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
          }}
        >
          <div
            className={cn(
              "flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#111111] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
              "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
            )}
          >
            <button
              type="button"
              onClick={handleAddToChat}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-white/80",
                "transition-all duration-200 [transition-timing-function:var(--ease-out)]",
                "hover:bg-white/[0.06] hover:scale-105 hover:-translate-y-[1px]",
                "active:scale-[0.97] motion-reduce:active:scale-100",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/[0.08]",
                "motion-reduce:transform-none motion-reduce:transition-none",
              )}
            >
              <Chat className="size-3" />
              Add to chat
            </button>
            <span className="px-2 py-1.5 text-xs text-white/40">
              {selection.startLine === selection.endLine
                ? `Line ${selection.startLine}`
                : `Lines ${selection.startLine}-${selection.endLine}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
