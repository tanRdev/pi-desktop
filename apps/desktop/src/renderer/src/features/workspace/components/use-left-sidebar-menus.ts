import * as React from "react";

export interface LeftSidebarRepositoryMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  repositoryId: string | null;
  repositoryName: string;
}

export interface LeftSidebarItemMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  type: "thread" | "worktree";
  id: string;
  label: string;
  confirming: "archive" | "delete" | null;
}

export interface LeftSidebarMenuTriggerEvent {
  preventDefault(): void;
  stopPropagation(): void;
  clientX: number;
  clientY: number;
}

export interface OpenRepositoryMenuInput {
  repositoryId: string;
  repositoryName: string;
}

export interface OpenThreadMenuInput {
  threadId: string;
  threadTitle: string;
}

export interface OpenWorktreeMenuInput {
  worktreeId: string;
  worktreeLabel: string;
}

export interface LeftSidebarItemMenuHandlers {
  onDeleteThread?: (threadId: string) => void;
  onDeleteWorktree?: (worktreeId: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onArchiveWorktree?: (worktreeId: string) => void;
}

export interface LeftSidebarMenusController {
  contextMenu: LeftSidebarRepositoryMenuState;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  itemMenu: LeftSidebarItemMenuState;
  itemMenuRef: React.RefObject<HTMLDivElement | null>;
  openRepositoryMenu: (
    event: LeftSidebarMenuTriggerEvent,
    input: OpenRepositoryMenuInput,
  ) => void;
  closeRepositoryMenu: () => void;
  runRepositoryMenuAction: (action: () => void | Promise<void>) => void;
  openThreadMenu: (
    event: LeftSidebarMenuTriggerEvent,
    input: OpenThreadMenuInput,
  ) => void;
  openWorktreeMenu: (
    event: LeftSidebarMenuTriggerEvent,
    input: OpenWorktreeMenuInput,
  ) => void;
  closeItemMenu: () => void;
  clearItemMenuConfirmation: () => void;
  confirmItemAction: (
    action: "archive" | "delete",
    handlers: LeftSidebarItemMenuHandlers,
  ) => void;
}

const CLOSED_REPOSITORY_MENU: LeftSidebarRepositoryMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  repositoryId: null,
  repositoryName: "",
};

const CLOSED_ITEM_MENU: LeftSidebarItemMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  type: "thread",
  id: "",
  label: "",
  confirming: null,
};

function shouldCloseForTarget(
  ref: React.RefObject<HTMLDivElement | null>,
  target: EventTarget | null,
) {
  if (!(target instanceof Node)) {
    return true;
  }

  const element = ref.current;
  if (!element) {
    return true;
  }

  return !element.contains(target);
}

export function useLeftSidebarMenus(): LeftSidebarMenusController {
  const [contextMenu, setContextMenu] =
    React.useState<LeftSidebarRepositoryMenuState>(CLOSED_REPOSITORY_MENU);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  const [itemMenu, setItemMenu] =
    React.useState<LeftSidebarItemMenuState>(CLOSED_ITEM_MENU);
  const itemMenuRef = React.useRef<HTMLDivElement>(null);

  const closeRepositoryMenu = React.useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const closeItemMenu = React.useCallback(() => {
    setItemMenu((prev) => ({ ...prev, isOpen: false, confirming: null }));
  }, []);

  const clearItemMenuConfirmation = React.useCallback(() => {
    setItemMenu((prev) => ({ ...prev, confirming: null }));
  }, []);

  React.useEffect(() => {
    if (!contextMenu.isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (shouldCloseForTarget(contextMenuRef, event.target)) {
        closeRepositoryMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRepositoryMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeRepositoryMenu, contextMenu.isOpen]);

  React.useEffect(() => {
    if (!itemMenu.isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (shouldCloseForTarget(itemMenuRef, event.target)) {
        closeItemMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeItemMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeItemMenu, itemMenu.isOpen]);

  const openRepositoryMenu = React.useCallback(
    (event: LeftSidebarMenuTriggerEvent, input: OpenRepositoryMenuInput) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        isOpen: true,
        x: event.clientX,
        y: event.clientY,
        repositoryId: input.repositoryId,
        repositoryName: input.repositoryName,
      });
    },
    [],
  );

  const runRepositoryMenuAction = React.useCallback(
    (action: () => void | Promise<void>) => {
      void action();
      closeRepositoryMenu();
    },
    [closeRepositoryMenu],
  );

  const openThreadMenu = React.useCallback(
    (event: LeftSidebarMenuTriggerEvent, input: OpenThreadMenuInput) => {
      event.preventDefault();
      event.stopPropagation();
      setItemMenu({
        isOpen: true,
        x: event.clientX,
        y: event.clientY,
        type: "thread",
        id: input.threadId,
        label: input.threadTitle,
        confirming: null,
      });
    },
    [],
  );

  const openWorktreeMenu = React.useCallback(
    (event: LeftSidebarMenuTriggerEvent, input: OpenWorktreeMenuInput) => {
      event.preventDefault();
      event.stopPropagation();
      setItemMenu({
        isOpen: true,
        x: event.clientX,
        y: event.clientY,
        type: "worktree",
        id: input.worktreeId,
        label: input.worktreeLabel,
        confirming: null,
      });
    },
    [],
  );

  const confirmItemAction = React.useCallback(
    (action: "archive" | "delete", handlers: LeftSidebarItemMenuHandlers) => {
      if (itemMenu.confirming !== action) {
        setItemMenu((prev) => ({ ...prev, confirming: action }));
        return;
      }

      if (action === "delete") {
        if (itemMenu.type === "thread") {
          handlers.onDeleteThread?.(itemMenu.id);
        } else {
          handlers.onDeleteWorktree?.(itemMenu.id);
        }
      } else if (itemMenu.type === "thread") {
        handlers.onArchiveThread?.(itemMenu.id);
      } else {
        handlers.onArchiveWorktree?.(itemMenu.id);
      }

      closeItemMenu();
    },
    [closeItemMenu, itemMenu.confirming, itemMenu.id, itemMenu.type],
  );

  return {
    contextMenu,
    contextMenuRef,
    itemMenu,
    itemMenuRef,
    openRepositoryMenu,
    closeRepositoryMenu,
    runRepositoryMenuAction,
    openThreadMenu,
    openWorktreeMenu,
    closeItemMenu,
    clearItemMenuConfirmation,
    confirmItemAction,
  };
}
