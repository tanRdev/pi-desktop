import {
  ArrowsOut,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@phosphor-icons/react";
import { cn } from "@pi-desktop/ui";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ICON_SIZE_SM, X } from "@/components/ui/phosphor-icons";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clampOffset(
  offset: { x: number; y: number },
  zoom: number,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  if (zoom <= 1) {
    return { x: 0, y: 0 };
  }

  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;

  const overflowX = Math.max(0, (scaledWidth - containerWidth) / 2);
  const overflowY = Math.max(0, (scaledHeight - containerHeight) / 2);

  return {
    x: Math.min(overflowX, Math.max(-overflowX, offset.x)),
    y: Math.min(overflowY, Math.max(-overflowY, offset.y)),
  };
}

export interface MediaPreviewProps {
  filePath: string;
  onClose: () => void;
}

function useMediaControls(containerRef: React.RefObject<HTMLElement | null>) {
  const [zoom, setZoomRaw] = React.useState(1);
  const [offset, setOffsetRaw] = React.useState({ x: 0, y: 0 });
  const [isFitToView, setIsFitToView] = React.useState(true);
  const [naturalSize, setNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
  });

  const setZoom = React.useCallback((nextZoom: number) => {
    const clamped = clampZoom(nextZoom);
    setZoomRaw(clamped);
    if (clamped <= 1) {
      setOffsetRaw({ x: 0, y: 0 });
      setIsFitToView(true);
    } else {
      setIsFitToView(false);
    }
  }, []);

  const zoomIn = React.useCallback(() => {
    setZoom(zoom + ZOOM_STEP);
  }, [zoom, setZoom]);

  const zoomOut = React.useCallback(() => {
    setZoom(zoom - ZOOM_STEP);
  }, [zoom, setZoom]);

  const fitToView = React.useCallback(() => {
    setZoom(1);
    setOffsetRaw({ x: 0, y: 0 });
    setIsFitToView(true);
  }, [setZoom]);

  const actualSize = React.useCallback(() => {
    setZoom(1);
    setOffsetRaw({ x: 0, y: 0 });
    setIsFitToView(false);
  }, [setZoom]);

  const handleWheel = React.useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const factor = 0.001;
      const delta = -event.deltaY * factor;
      const nextZoom = clampZoom(zoom + delta * zoom);
      setZoomRaw(nextZoom);
      if (nextZoom <= 1) {
        setOffsetRaw({ x: 0, y: 0 });
        setIsFitToView(true);
      } else {
        setIsFitToView(false);
      }
    },
    [zoom],
  );

  const handleDragStart = React.useCallback(
    (event: React.MouseEvent) => {
      if (zoom <= 1) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    },
    [zoom, offset],
  );

  const handleDragMove = React.useCallback(
    (event: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;

      const nextOffset = {
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      };

      const container = containerRef.current;
      if (container && naturalSize) {
        const clamped = clampOffset(
          nextOffset,
          zoom,
          naturalSize.width,
          naturalSize.height,
          container.clientWidth,
          container.clientHeight,
        );
        setOffsetRaw(clamped);
      } else {
        setOffsetRaw(nextOffset);
      }
    },
    [isDragging, zoom, containerRef, naturalSize],
  );

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(event: MouseEvent) {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;

      const nextOffset = {
        x: dragStartRef.current.offsetX + dx,
        y: dragStartRef.current.offsetY + dy,
      };

      const container = containerRef.current;
      if (container && naturalSize) {
        const clamped = clampOffset(
          nextOffset,
          zoom,
          naturalSize.width,
          naturalSize.height,
          container.clientWidth,
          container.clientHeight,
        );
        setOffsetRaw(clamped);
      } else {
        setOffsetRaw(nextOffset);
      }
    }

    function onMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, zoom, containerRef, naturalSize]);

  return {
    zoom,
    offset,
    zoomIn,
    zoomOut,
    fitToView,
    actualSize,
    isFitToView,
    naturalSize,
    handleWheel,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    setNaturalSize,
  };
}

const ZOOM_PERCENT = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 0,
});

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

export function MediaPreview({ filePath, onClose }: MediaPreviewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);

  const controls = useMediaControls(containerRef);

  const fileName = getFileName(filePath);
  const currentZoomDisplay = ZOOM_PERCENT.format(controls.zoom);

  const cursorStyle =
    controls.zoom > 1 ? (isMouseDown ? "grabbing" : "grab") : "default";

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      setIsMouseDown(true);
      controls.handleDragStart(event);
    },
    [controls],
  );

  const handleMouseUp = React.useCallback(() => {
    setIsMouseDown(false);
    controls.handleDragEnd();
  }, [controls]);

  const handleImageLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoaded(true);
      setImageError(false);
      const img = event.currentTarget;
      controls.setNaturalSize({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    },
    [controls],
  );

  const handleImageError = React.useCallback(() => {
    setImageError(true);
    setIsLoaded(false);
  }, []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        controls.zoomIn();
        return;
      }
      if (event.key === "-") {
        controls.zoomOut();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, controls]);

  const transformStyle: React.CSSProperties =
    controls.zoom !== 1
      ? {
          transform: `translate(${controls.offset.x}px, ${controls.offset.y}px) scale(${controls.zoom})`,
          transformOrigin: "center center",
        }
      : {};

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      data-testid="media-preview-overlay"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.04] bg-transparent px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-[11px] font-normal uppercase tracking-wider text-white/50">
              {fileName}
            </span>
            {controls.naturalSize && (
              <span className="shrink-0 text-[11px] text-white/45">
                {controls.naturalSize.width}×{controls.naturalSize.height}
              </span>
            )}
            {controls.zoom > 1 && (
              <span className="shrink-0 text-[11px] text-white/45">
                {currentZoomDisplay}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={controls.zoomOut}
              disabled={controls.zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <MagnifyingGlassMinus className={ICON_SIZE_SM} />
            </Button>
            <span className="min-w-[3rem] text-center text-[11px] tabular-nums text-white/40">
              {currentZoomDisplay}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={controls.zoomIn}
              disabled={controls.zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <MagnifyingGlassPlus className={ICON_SIZE_SM} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={
                controls.isFitToView ? controls.actualSize : controls.fitToView
              }
              aria-label={controls.isFitToView ? "Actual size" : "Fit to view"}
              title={controls.isFitToView ? "Actual size" : "Fit to view"}
            >
              <ArrowsOut className={ICON_SIZE_SM} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X className={ICON_SIZE_SM} />
            </Button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative min-h-0 flex-1 overflow-hidden"
          onWheel={controls.handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={controls.handleDragMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: cursorStyle }}
          data-testid="media-preview-viewport"
        >
          {imageError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/50">
              <span className="text-sm">Unable to load image</span>
              <span className="text-xs text-white/50">{fileName}</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-64 animate-pulse rounded bg-white/5" />
                </div>
              )}
              <img
                src={filePath}
                alt={fileName}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
                className={cn(
                  "max-h-full max-w-full select-none object-contain transition-transform duration-100 ease-out",
                )}
                style={transformStyle}
                data-testid="media-preview-image"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
