// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_SIDEBAR_WIDTH,
  useLeftSidebarLayout,
} from "./use-left-sidebar-layout";

type SidebarTab = "workspaces" | "git" | "files";

interface LeftSidebarLayoutOptions {
  width: number;
  activeRepositoryId: string | null;
  activeTabOverride?: SidebarTab;
  onResize: (width: number) => void;
  onSelectRepository: (repositoryId: string) => void;
  onCreateSession: () => void | Promise<void>;
}

interface LeftSidebarLayoutController {
  isCollapsed: boolean;
  isCreatingSession: boolean;
  activeTab: SidebarTab;
  expandedRepositoryIds: Set<string>;
  handleSelectProject: (repositoryId: string) => void;
  handleCreateSession: () => Promise<void>;
  handleHideSidebar: () => void;
  handleShowSidebar: () => void;
  handleResizeDragStart: (
    event: Pick<React.MouseEvent, "clientX" | "preventDefault">,
  ) => void;
}

function createOptions(
  overrides: Partial<LeftSidebarLayoutOptions> = {},
): LeftSidebarLayoutOptions {
  return {
    width: 240,
    activeRepositoryId: "repo-1",
    activeTabOverride: undefined,
    onResize: vi.fn(),
    onSelectRepository: vi.fn(),
    onCreateSession: vi.fn(),
    ...overrides,
  };
}

function createMouseEvent(
  clientX: number,
): Pick<React.MouseEvent, "clientX" | "preventDefault"> {
  return {
    clientX,
    preventDefault: vi.fn(),
  };
}

afterEach(() => {
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

describe("useLeftSidebarLayout", () => {
  it("derives active tab and expanded repository state from props", async () => {
    const options = createOptions();
    const { result, rerender } = renderHook<
      LeftSidebarLayoutController,
      LeftSidebarLayoutOptions
    >((props) => useLeftSidebarLayout(props), { initialProps: options });

    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.activeTab).toBe("workspaces");
    expect(Array.from(result.current.expandedRepositoryIds)).toEqual([
      "repo-1",
    ]);

    rerender(createOptions({ activeTabOverride: "git" }));

    await waitFor(() => {
      expect(result.current.activeTab).toBe("git");
    });

    rerender(
      createOptions({
        activeRepositoryId: "repo-2",
        activeTabOverride: "files",
      }),
    );

    await waitFor(() => {
      expect(result.current.activeTab).toBe("files");
      expect(Array.from(result.current.expandedRepositoryIds)).toEqual([
        "repo-2",
      ]);
    });
  });

  it("toggles the active repository and selects inactive repositories", () => {
    const onSelectRepository = vi.fn();
    const { result } = renderHook<
      LeftSidebarLayoutController,
      LeftSidebarLayoutOptions
    >((props) => useLeftSidebarLayout(props), {
      initialProps: createOptions({ onSelectRepository }),
    });

    act(() => {
      result.current.handleSelectProject("repo-1");
    });

    expect(Array.from(result.current.expandedRepositoryIds)).toEqual([]);
    expect(onSelectRepository).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSelectProject("repo-1");
    });

    expect(Array.from(result.current.expandedRepositoryIds)).toEqual([
      "repo-1",
    ]);
    expect(onSelectRepository).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSelectProject("repo-2");
    });

    expect(Array.from(result.current.expandedRepositoryIds)).toEqual([
      "repo-2",
    ]);
    expect(onSelectRepository).toHaveBeenCalledWith("repo-2");
  });

  it("guards session creation while a session is already being created", async () => {
    let resolveCreate: (() => void) | null = null;
    const onCreateSession = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const { result } = renderHook<
      LeftSidebarLayoutController,
      LeftSidebarLayoutOptions
    >((props) => useLeftSidebarLayout(props), {
      initialProps: createOptions({ onCreateSession }),
    });

    await act(async () => {
      void result.current.handleCreateSession();
    });

    await waitFor(() => {
      expect(result.current.isCreatingSession).toBe(true);
    });

    await act(async () => {
      await result.current.handleCreateSession();
    });

    expect(onCreateSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate?.();
    });

    await waitFor(() => {
      expect(result.current.isCreatingSession).toBe(false);
    });
  });

  it("hides the sidebar and restores the last expanded width", () => {
    const onResize = vi.fn();
    const { result, rerender } = renderHook<
      LeftSidebarLayoutController,
      LeftSidebarLayoutOptions
    >((props) => useLeftSidebarLayout(props), {
      initialProps: createOptions({ onResize, width: 320 }),
    });

    act(() => {
      result.current.handleHideSidebar();
    });

    expect(onResize).toHaveBeenCalledWith(0);

    rerender(createOptions({ onResize, width: 0 }));

    act(() => {
      result.current.handleShowSidebar();
    });

    expect(onResize).toHaveBeenLastCalledWith(320);
  });

  it("clamps resize drag widths and collapses below the threshold", () => {
    const onResize = vi.fn();
    const { result } = renderHook<
      LeftSidebarLayoutController,
      LeftSidebarLayoutOptions
    >((props) => useLeftSidebarLayout(props), {
      initialProps: createOptions({ onResize, width: 240 }),
    });

    act(() => {
      result.current.handleResizeDragStart(createMouseEvent(200));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 700 }));
    });

    expect(onResize).toHaveBeenLastCalledWith(MAX_SIDEBAR_WIDTH);
    expect(document.body.style.cursor).toBe("ew-resize");
    expect(document.body.style.userSelect).toBe("none");

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 10 }));
    });

    expect(onResize).toHaveBeenLastCalledWith(0);

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup"));
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");

    act(() => {
      result.current.handleResizeDragStart(createMouseEvent(200));
    });

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 140 }));
    });

    expect(onResize).toHaveBeenLastCalledWith(180);
  });
});
