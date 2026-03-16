"use client";

import { Plus, MessageSquare } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CodeBlockCode } from "./code-block";

interface LineSelection {
  startLine: number;
  endLine: number;
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
  const [popoverPosition, setPopoverPosition] = React.useState({ top: 0, left: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear selection when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelection(null);
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show popover when selection changes
  React.useEffect(() => {
    if (selection) {
      // Calculate popover position based on selected line
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

  function handleLineClick(lineNumber: number, e: React.MouseEvent) {
    if (e.shiftKey && selection) {
      // Extend selection
      const startLine = Math.min(selection.startLine, lineNumber);
      const endLine = Math.max(selection.endLine, lineNumber);
      setSelection({ startLine, endLine });
    } else {
      // New selection
      setSelection({ startLine: lineNumber, endLine: lineNumber });
    }

    // Position popover near the clicked line
    const lineElement = (e.currentTarget as HTMLElement).closest(".line-row");
    if (lineElement) {
      const rect = lineElement.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setPopoverPosition({
          top: rect.top - containerRect.top + rect.height,
          left: 60,
        });
      }
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
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Code with line numbers overlay */}
      <div className="flex">
        {/* Line numbers column */}
        <div
          className="sticky left-0 z-10 shrink-0 select-none bg-background"
          style={{ width: `${lineNumberWidth}rem` }}
        >
          <div className="flex flex-col font-mono text-[13px] leading-relaxed">
            {lines.map((_, index) => {
              const lineNumber = index + 1;
              const isSelected = isLineSelected(lineNumber);
              const isHovered = hoveredLine === lineNumber;

              return (
                <div
                  key={lineNumber}
                  className="line-row group relative flex h-[1.625rem] items-center"
                  onMouseEnter={() => setHoveredLine(lineNumber)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* Selection highlight */}
                  {isSelected && (
                    <div className="pointer-events-none absolute inset-0 -left-4 right-0 bg-primary/10" />
                  )}

                  {/* Hover highlight */}
                  {isHovered && !isSelected && (
                    <div className="pointer-events-none absolute inset-0 -left-4 right-0 bg-surface-2/50" />
                  )}

                  {/* Plus button */}
                  <button
                    type="button"
                    onClick={(e) => handleLineClick(lineNumber, e)}
                    className={cn(
                      "absolute left-0 flex size-4 items-center justify-center rounded text-muted-foreground transition",
                      isHovered || isSelected
                        ? "opacity-100 hover:bg-surface-3 hover:text-foreground"
                        : "opacity-0"
                    )}
                    aria-label={`Select line ${lineNumber}`}
                  >
                    <Plus className="size-3" />
                  </button>

                  {/* Line number */}
                  <span
                    className={cn(
                      "ml-5 text-right text-xs",
                      isSelected ? "text-primary font-medium" : "text-muted-foreground/50"
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
          <CodeBlockCode code={code} language={language} className="min-h-full" />
        </div>
      </div>

      {/* Popover */}
      {showPopover && selection && (
        <div
          className="absolute z-20 animate-in fade-in-0 slide-in-from-top-1"
          style={{
            top: popoverPosition.top,
            left: popoverPosition.left,
          }}
        >
          <div className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button
              type="button"
              onClick={handleAddToChat}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-popover-foreground transition hover:bg-accent"
            >
              <MessageSquare className="size-3" />
              Add to chat
            </button>
            <span className="px-2 py-1.5 text-xs text-muted-foreground">
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