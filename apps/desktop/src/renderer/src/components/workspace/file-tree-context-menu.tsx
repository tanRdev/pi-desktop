import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowRight, PencilSimple, Trash } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface FileTreeContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  fileName: string;
  isDirectory: boolean;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onMove: (path: string) => void;
  onClose: () => void;
}

export function FileTreeContextMenu({
  x,
  y,
  filePath,
  onRename,
  onDelete,
  onMove,
  onClose,
}: FileTreeContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const itemClass =
    "flex items-center gap-2 w-full px-3 py-1.5 text-[10.5px] text-white/60 hover:text-white/80 hover:bg-white/[0.06] transition-colors duration-75";

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-[var(--color-bg-quaternary)] border border-white/[0.08] shadow-xl shadow-black/50 rounded-none py-1"
      style={{ top: y, left: x }}
    >
      <button
        type="button"
        className={itemClass}
        onClick={() => {
          onRename(filePath);
          onClose();
        }}
      >
        <PencilSimple className="w-3.5 h-3.5" weight="light" />
        <span>Rename</span>
      </button>
      <button
        type="button"
        className={itemClass}
        onClick={() => {
          onMove(filePath);
          onClose();
        }}
      >
        <ArrowRight className="w-3.5 h-3.5" weight="light" />
        <span>Move to...</span>
      </button>
      <div className="my-1 border-t border-white/[0.06]" />
      <button
        type="button"
        className={cn(itemClass, "text-red-400/70 hover:text-red-400")}
        onClick={() => {
          onDelete(filePath);
          onClose();
        }}
      >
        <Trash className="w-3.5 h-3.5" weight="light" />
        <span>Delete</span>
      </button>
    </div>,
    document.body,
  );
}
