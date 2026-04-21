import { UploadSimple } from "@phosphor-icons/react";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DropZoneProps = {
  children: React.ReactNode;
  onFilesDropped: (files: File[]) => void;
  className?: string;
  disabled?: boolean;
};

export function DropZone({
  children,
  onFilesDropped,
  className,
  disabled = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current += 1;
      if (dragCounter.current === 1) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounter.current -= 1;
      if (dragCounter.current === 0) {
        setIsDragOver(false);
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesDropped(files);
      }
    },
    [disabled, onFilesDropped],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative", className)}
    >
      {children}
      {isDragOver && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 rounded-md bg-black/60 backdrop-blur-sm">
          <UploadSimple size={32} className="text-white/70" weight="bold" />
          <span className="text-sm text-white/70">Drop files here</span>
        </div>
      )}
    </div>
  );
}
