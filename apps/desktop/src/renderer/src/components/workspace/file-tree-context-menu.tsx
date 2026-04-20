import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Copy,
  Export,
  PencilSimple,
  PushPin,
  PushPinSlash,
  Trash,
} from "@/components/ui/icons";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface FileTreeContextMenuProps {
  x: number;
  y: number;
  filePath: string;
  fileName: string;
  isDirectory: boolean;
  workspacePath?: string | null;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onMove: (path: string) => void;
  onClose: () => void;
  isPinned?: boolean;
  onPin?: (path: string) => void;
  onUnpin?: (path: string) => void;
}

function toRelativePath(
  filePath: string,
  workspacePath: string | null | undefined,
): string {
  if (!workspacePath) return filePath;
  if (filePath === workspacePath) return "";
  const prefix = workspacePath.endsWith("/")
    ? workspacePath
    : `${workspacePath}/`;
  if (filePath.startsWith(prefix)) {
    return filePath.slice(prefix.length);
  }
  return filePath;
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Reveal in Finder" fallback: the existing IPC surface only exposes
 * `repositories.openInFinder(repositoryId)`, which needs a known repo id.
 * For an arbitrary path we do not have a dedicated channel today, so we
 * copy the path and surface a toast — non-destructive, honest fallback.
 */
async function revealInFinder(filePath: string): Promise<void> {
  const copied = await copyToClipboard(filePath);
  if (copied) {
    toast.info("Reveal in Finder not wired yet", {
      description: "Path copied to clipboard — open Finder manually.",
    });
  } else {
    toast.warning("Reveal in Finder not available");
  }
}

export function FileTreeContextMenu({
  x,
  y,
  filePath,
  onRename,
  onDelete,
  onMove,
  onClose,
  isDirectory,
  workspacePath,
  isPinned,
  onPin,
  onUnpin,
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

  async function handleCopyPath() {
    const ok = await copyToClipboard(filePath);
    if (ok) toast.success("Path copied");
    else toast.warning("Clipboard unavailable");
    onClose();
  }

  async function handleCopyRelativePath() {
    const rel = toRelativePath(filePath, workspacePath);
    const ok = await copyToClipboard(rel);
    if (ok) toast.success("Relative path copied");
    else toast.warning("Clipboard unavailable");
    onClose();
  }

  async function handleReveal() {
    await revealInFinder(filePath);
    onClose();
  }

  function handleDeleteWithConfirm() {
    const name = filePath.split("/").pop() ?? filePath;
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`Delete "${name}"? This cannot be undone.`)
        : true;
    if (!ok) {
      onClose();
      return;
    }
    onDelete(filePath);
    onClose();
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="File actions"
      className="fixed z-50 min-w-[180px] bg-[var(--color-bg-quaternary)] border border-white/[0.08] shadow-xl shadow-black/50 rounded-none py-1"
      style={{ top: y, left: x }}
    >
      {!isDirectory && onPin && !isPinned && (
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          onClick={() => {
            onPin(filePath);
            onClose();
          }}
        >
          <PushPin className="w-3.5 h-3.5" weight="light" />
          <span>Pin to Recent</span>
        </button>
      )}
      {!isDirectory && onUnpin && isPinned && (
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          onClick={() => {
            onUnpin(filePath);
            onClose();
          }}
        >
          <PushPinSlash className="w-3.5 h-3.5" weight="light" />
          <span>Unpin from Recent</span>
        </button>
      )}
      <button
        type="button"
        role="menuitem"
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
        role="menuitem"
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
        role="menuitem"
        className={itemClass}
        onClick={handleCopyPath}
      >
        <Copy className="w-3.5 h-3.5" weight="light" />
        <span>Copy path</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={handleCopyRelativePath}
      >
        <Copy className="w-3.5 h-3.5" weight="light" />
        <span>Copy relative path</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        onClick={handleReveal}
      >
        <Export className="w-3.5 h-3.5" weight="light" />
        <span>Reveal in Finder</span>
      </button>
      <div className="my-1 border-t border-white/[0.06]" />
      <button
        type="button"
        role="menuitem"
        className={cn(itemClass, "text-red-400/70 hover:text-red-400")}
        onClick={handleDeleteWithConfirm}
      >
        <Trash className="w-3.5 h-3.5" weight="light" />
        <span>Delete</span>
      </button>
    </div>,
    document.body,
  );
}
