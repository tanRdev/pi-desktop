// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeftSidebarMenus } from "./use-left-sidebar-menus";

function renderEscape() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
    }),
  );
}

function renderOutsideMouseDown() {
  document.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
    }),
  );
}

function createContextMenuEvent() {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 144,
    clientY: 288,
  } satisfies Pick<
    React.MouseEvent,
    "preventDefault" | "stopPropagation" | "clientX" | "clientY"
  >;
}

describe("useLeftSidebarMenus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens and closes the repository context menu", () => {
    const { result } = renderHook(() => useLeftSidebarMenus());
    const event = createContextMenuEvent();

    act(() => {
      result.current.openRepositoryMenu(event, {
        repositoryId: "repo-1",
        repositoryName: "Alpha Workspace",
      });
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(result.current.contextMenu).toEqual({
      isOpen: true,
      x: 144,
      y: 288,
      repositoryId: "repo-1",
      repositoryName: "Alpha Workspace",
    });

    act(() => {
      result.current.closeRepositoryMenu();
    });

    expect(result.current.contextMenu.isOpen).toBe(false);
  });

  it("opens thread and worktree item menus and confirms actions on second click", () => {
    const onDeleteThread = vi.fn();
    const onArchiveWorktree = vi.fn();
    const { result } = renderHook(() => useLeftSidebarMenus());

    act(() => {
      result.current.openThreadMenu(createContextMenuEvent(), {
        threadId: "thread-1",
        threadTitle: "Signal",
      });
    });

    expect(result.current.itemMenu).toEqual({
      isOpen: true,
      x: 144,
      y: 288,
      type: "thread",
      id: "thread-1",
      label: "Signal",
      confirming: null,
    });

    act(() => {
      result.current.confirmItemAction("delete", {
        onDeleteThread,
      });
    });

    expect(result.current.itemMenu.confirming).toBe("delete");
    expect(onDeleteThread).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmItemAction("delete", {
        onDeleteThread,
      });
    });

    expect(onDeleteThread).toHaveBeenCalledWith("thread-1");
    expect(result.current.itemMenu.isOpen).toBe(false);

    act(() => {
      result.current.openWorktreeMenu(createContextMenuEvent(), {
        worktreeId: "worktree-2",
        worktreeLabel: "feature/session-tabs",
      });
    });

    act(() => {
      result.current.confirmItemAction("archive", {
        onArchiveWorktree,
      });
    });

    act(() => {
      result.current.confirmItemAction("archive", {
        onArchiveWorktree,
      });
    });

    expect(onArchiveWorktree).toHaveBeenCalledWith("worktree-2");
    expect(result.current.itemMenu.isOpen).toBe(false);
  });

  it("clears confirming state without closing the item menu", () => {
    const { result } = renderHook(() => useLeftSidebarMenus());

    act(() => {
      result.current.openThreadMenu(createContextMenuEvent(), {
        threadId: "thread-1",
        threadTitle: "Signal",
      });
      result.current.confirmItemAction("archive", {});
    });

    expect(result.current.itemMenu.confirming).toBe("archive");

    act(() => {
      result.current.clearItemMenuConfirmation();
    });

    expect(result.current.itemMenu.isOpen).toBe(true);
    expect(result.current.itemMenu.confirming).toBeNull();
  });

  it("closes both menus on outside click and escape", () => {
    const { result } = renderHook(() => useLeftSidebarMenus());

    act(() => {
      result.current.openRepositoryMenu(createContextMenuEvent(), {
        repositoryId: "repo-1",
        repositoryName: "Alpha Workspace",
      });
      result.current.openThreadMenu(createContextMenuEvent(), {
        threadId: "thread-1",
        threadTitle: "Signal",
      });
    });

    act(() => {
      renderOutsideMouseDown();
    });

    expect(result.current.contextMenu.isOpen).toBe(false);
    expect(result.current.itemMenu.isOpen).toBe(false);

    act(() => {
      result.current.openRepositoryMenu(createContextMenuEvent(), {
        repositoryId: "repo-1",
        repositoryName: "Alpha Workspace",
      });
      result.current.openThreadMenu(createContextMenuEvent(), {
        threadId: "thread-1",
        threadTitle: "Signal",
      });
      result.current.confirmItemAction("delete", {});
    });

    act(() => {
      renderEscape();
    });

    expect(result.current.contextMenu.isOpen).toBe(false);
    expect(result.current.itemMenu.isOpen).toBe(false);
    expect(result.current.itemMenu.confirming).toBeNull();
  });
});
