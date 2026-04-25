import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { createPortal } from "react-dom";
import { CaretRight, Copy, Export } from "@/components/ui/phosphor-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/lib/toast";
import { type BreadcrumbSegment, useBreadcrumb } from "./use-breadcrumb";

const OVERFLOW_THRESHOLD = 4;
const VISIBLE_START = 1;
const VISIBLE_END = 2;

interface BreadcrumbContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
}

function BreadcrumbContextMenu({
  x,
  y,
  path,
  onClose,
}: BreadcrumbContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleCopyPath() {
    try {
      await navigator.clipboard.writeText(path);
      toast.success("Path copied");
    } catch {
      toast.warning("Clipboard unavailable");
    }
    onClose();
  }

  async function handleRevealInFinder() {
    try {
      await navigator.clipboard.writeText(path);
      toast.info("Reveal in Finder not wired yet", {
        description: "Path copied to clipboard — open Finder manually.",
      });
    } catch {
      toast.warning("Reveal in Finder not available");
    }
    onClose();
  }

  const itemClass =
    "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-75";

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Breadcrumb actions"
      className="fixed z-50 min-w-[180px] bg-[var(--color-bg-quaternary)] border border-white/[0.08] shadow-xl shadow-black/50 rounded-none py-1"
      style={{ top: y, left: x }}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={handleCopyPath}
      >
        <Copy className="w-3.5 h-3.5" weight="light" />
        <span>Copy Path</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={handleRevealInFinder}
      >
        <Export className="w-3.5 h-3.5" weight="light" />
        <span>Reveal in Finder</span>
      </button>
    </div>,
    document.body,
  );
}

interface BreadcrumbSegmentItemProps {
  segment: BreadcrumbSegment;
  onNavigate: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string) => void;
  isFocused: boolean;
  onFocus: () => void;
}

function BreadcrumbSegmentItem({
  segment,
  onNavigate,
  onContextMenu,
  isFocused,
  onFocus,
}: BreadcrumbSegmentItemProps) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  if (segment.isLast) {
    return (
      <span
        className="text-sm text-[var(--color-text-primary)] font-medium whitespace-nowrap"
        onContextMenu={(e) => onContextMenu(e, segment.path)}
        data-testid="breadcrumb-segment-last"
      >
        {segment.label}
      </span>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors whitespace-nowrap outline-none focus:text-[var(--color-text-primary)]"
      onClick={() => onNavigate(segment.path)}
      onContextMenu={(e) => onContextMenu(e, segment.path)}
      onFocus={onFocus}
      data-testid="breadcrumb-segment"
      data-path={segment.path}
    >
      {segment.label}
    </button>
  );
}

interface OverflowSegmentsProps {
  hiddenSegments: BreadcrumbSegment[];
  onNavigate: (path: string) => void;
}

function OverflowSegments({
  hiddenSegments,
  onNavigate,
}: OverflowSegmentsProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors outline-none px-1"
          data-testid="breadcrumb-overflow"
        >
          ...
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-[160px] p-1">
        {hiddenSegments.map((segment) => (
          <button
            key={segment.path}
            type="button"
            className="flex w-full items-center px-2 py-1 text-[11px] text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-75 text-left"
            onClick={() => onNavigate(segment.path)}
            data-testid="breadcrumb-overflow-segment"
            data-path={segment.path}
          >
            {segment.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const Separator = () => (
  <CaretRight
    className="size-2 text-[var(--color-text-quaternary)] mx-0.5 shrink-0"
    weight="bold"
  />
);

export interface BreadcrumbProps {
  filePath: string | null;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function Breadcrumb({
  filePath,
  onNavigate,
  className,
}: BreadcrumbProps) {
  const { segments, navigateTo } = useBreadcrumb(filePath, onNavigate);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);

  const visibleSegments = React.useMemo(() => {
    if (segments.length <= OVERFLOW_THRESHOLD) {
      return { start: segments, hidden: [], end: [] };
    }

    const start = segments.slice(0, VISIBLE_START);
    const hidden = segments.slice(VISIBLE_START, segments.length - VISIBLE_END);
    const end = segments.slice(segments.length - VISIBLE_END);

    return { start, hidden, end };
  }, [segments]);

  const navigableSegments = React.useMemo(() => {
    if (segments.length <= OVERFLOW_THRESHOLD) return segments;
    return [
      ...visibleSegments.start,
      ...visibleSegments.hidden,
      ...visibleSegments.end,
    ];
  }, [segments, visibleSegments]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedIndex((prev) =>
        prev < navigableSegments.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      const segment = navigableSegments[focusedIndex];
      if (segment && !segment.isLast) {
        navigateTo(segment.path);
      }
    }
  }

  function handleContextMenu(e: React.MouseEvent, path: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }

  function handleNavigate(path: string) {
    navigateTo(path);
  }

  if (!filePath || segments.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      data-testid="breadcrumb"
      className={cn(
        "flex h-7 items-center bg-[var(--color-bg-secondary)] px-3 border-b border-white/[0.04] overflow-hidden outline-none",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {visibleSegments.start.map((segment) => (
        <React.Fragment key={segment.path}>
          <BreadcrumbSegmentItem
            segment={segment}
            onNavigate={handleNavigate}
            onContextMenu={handleContextMenu}
            isFocused={
              focusedIndex >= 0 &&
              navigableSegments[focusedIndex]?.path === segment.path
            }
            onFocus={() => {
              const idx = navigableSegments.findIndex(
                (s) => s.path === segment.path,
              );
              setFocusedIndex(idx);
            }}
          />
          <Separator />
        </React.Fragment>
      ))}

      {visibleSegments.hidden.length > 0 && (
        <>
          <OverflowSegments
            hiddenSegments={visibleSegments.hidden}
            onNavigate={handleNavigate}
          />
          <Separator />
        </>
      )}

      {visibleSegments.end.map((segment, i) => (
        <React.Fragment key={segment.path}>
          <BreadcrumbSegmentItem
            segment={segment}
            onNavigate={handleNavigate}
            onContextMenu={handleContextMenu}
            isFocused={
              focusedIndex >= 0 &&
              navigableSegments[focusedIndex]?.path === segment.path
            }
            onFocus={() => {
              const idx = navigableSegments.findIndex(
                (s) => s.path === segment.path,
              );
              setFocusedIndex(idx);
            }}
          />
          {i < visibleSegments.end.length - 1 && <Separator />}
        </React.Fragment>
      ))}

      {contextMenu &&
        createPortal(
          <BreadcrumbContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            path={contextMenu.path}
            onClose={() => setContextMenu(null)}
          />,
          document.body,
        )}
    </nav>
  );
}
