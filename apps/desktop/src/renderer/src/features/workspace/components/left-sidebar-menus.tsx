import type * as React from "react";
import { Archive, Copy, Trash } from "@/components/ui/phosphor-icons";
import type {
  LeftSidebarItemMenuState,
  LeftSidebarRepositoryMenuState,
} from "./use-left-sidebar-menus";

interface LeftSidebarRepositoryMenuProps {
  menu: LeftSidebarRepositoryMenuState;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onCopyPath?: (repositoryId: string) => void;
  onOpenInFinder?: (repositoryId: string) => void;
  onRemoveRepository?: (repositoryId: string) => void;
}

export function LeftSidebarRepositoryMenu({
  menu,
  menuRef,
  onCopyPath,
  onOpenInFinder,
  onRemoveRepository,
}: LeftSidebarRepositoryMenuProps) {
  if (!menu.isOpen || menu.repositoryId === null) {
    return null;
  }

  const repositoryId = menu.repositoryId;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-0 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="block truncate text-[12px] text-white/60">
          {menu.repositoryName}
        </span>
      </div>
      {onCopyPath ? (
        <button
          type="button"
          onClick={() => onCopyPath(repositoryId)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"
        >
          <Copy className="size-4" />
          Copy path
        </button>
      ) : null}
      {onOpenInFinder ? (
        <button
          type="button"
          onClick={() => onOpenInFinder(repositoryId)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
            />
          </svg>
          Open in Finder
        </button>
      ) : null}
      {onRemoveRepository ? (
        <>
          <div className="my-1 border-t border-white/[0.06]" />
          <button
            type="button"
            onClick={() => onRemoveRepository(repositoryId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
          >
            <Trash className="size-4" />
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}

interface LeftSidebarItemMenuProps {
  menu: LeftSidebarItemMenuState;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onConfirmAction: (action: "archive" | "delete") => void;
  onClearConfirmation: () => void;
}

function ItemMenuConfirmation({
  action,
  type,
  onConfirmAction,
  onClearConfirmation,
}: {
  action: "archive" | "delete";
  type: LeftSidebarItemMenuState["type"];
  onConfirmAction: (action: "archive" | "delete") => void;
  onClearConfirmation: () => void;
}) {
  const copy =
    action === "archive"
      ? `Archive this ${type}?`
      : `Delete this ${type}? This cannot be undone.`;
  const confirmLabel = action === "archive" ? "Archive" : "Delete";
  const confirmClassName =
    action === "archive"
      ? "flex-1 py-1 text-[11px] text-amber-400 hover:bg-amber-500/10 transition-colors duration-150"
      : "flex-1 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150";

  return (
    <div className="px-3 py-2 space-y-1.5">
      <p className="text-[11px] text-white/50">{copy}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onConfirmAction(action)}
          className={confirmClassName}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onClearConfirmation}
          className="flex-1 py-1 text-[11px] text-white/40 hover:bg-white/[0.06] transition-colors duration-150"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function LeftSidebarItemMenu({
  menu,
  menuRef,
  onConfirmAction,
  onClearConfirmation,
}: LeftSidebarItemMenuProps) {
  if (!menu.isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] border border-white/[0.06] bg-[var(--color-bg-primary)] p-0 shadow-lg"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="block truncate text-[12px] text-white/60">
          {menu.label}
        </span>
      </div>

      {menu.confirming === "archive" ? (
        <ItemMenuConfirmation
          action="archive"
          type={menu.type}
          onConfirmAction={onConfirmAction}
          onClearConfirmation={onClearConfirmation}
        />
      ) : menu.confirming === "delete" ? (
        <ItemMenuConfirmation
          action="delete"
          type={menu.type}
          onConfirmAction={onConfirmAction}
          onClearConfirmation={onClearConfirmation}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => onConfirmAction("archive")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"
          >
            <Archive className="size-4" />
            Archive
          </button>
          <div className="my-0.5 border-t border-white/[0.06]" />
          <button
            type="button"
            onClick={() => onConfirmAction("delete")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
          >
            <Trash className="size-4" />
            Delete
          </button>
        </>
      )}
    </div>
  );
}
