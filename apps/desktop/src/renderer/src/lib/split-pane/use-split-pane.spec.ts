// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSplitPane } from "./use-split-pane";

const STORAGE_PREFIX = "pi-desktop:split-pane:";

beforeEach(() => {
  localStorage.clear();
});

describe("useSplitPane", () => {
  it("initializes with defaultSize when no persisted value", () => {
    const { result } = renderHook(() =>
      useSplitPane({
        id: "test",
        defaultSize: 40,
        minSize: 10,
        maxSize: 90,
      }),
    );
    expect(result.current.size).toBe(40);
  });

  it("initializes with persisted value from localStorage", () => {
    localStorage.setItem(`${STORAGE_PREFIX}test`, "65");
    const { result } = renderHook(() =>
      useSplitPane({
        id: "test",
        defaultSize: 40,
        minSize: 10,
        maxSize: 90,
      }),
    );
    expect(result.current.size).toBe(65);
  });

  it("clamps persisted value to min/max constraints", () => {
    localStorage.setItem(`${STORAGE_PREFIX}test`, "95");
    const { result } = renderHook(() =>
      useSplitPane({
        id: "test",
        defaultSize: 40,
        minSize: 10,
        maxSize: 80,
      }),
    );
    expect(result.current.size).toBe(80);
  });

  it("clamps persisted value below minSize", () => {
    localStorage.setItem(`${STORAGE_PREFIX}test`, "3");
    const { result } = renderHook(() =>
      useSplitPane({
        id: "test",
        defaultSize: 40,
        minSize: 10,
        maxSize: 90,
      }),
    );
    expect(result.current.size).toBe(10);
  });

  it("clamps defaultSize to min/max", () => {
    const { result } = renderHook(() =>
      useSplitPane({
        id: "clamp-default",
        defaultSize: 5,
        minSize: 10,
        maxSize: 90,
      }),
    );
    expect(result.current.size).toBe(10);
  });

  describe("setSize", () => {
    it("updates size and persists to localStorage", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "set-test",
          defaultSize: 40,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.setSize(60);
      });

      expect(result.current.size).toBe(60);
      expect(localStorage.getItem(`${STORAGE_PREFIX}set-test`)).toBe("60");
    });

    it("clamps to maxSize", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "clamp-max",
          defaultSize: 40,
          minSize: 10,
          maxSize: 70,
        }),
      );

      act(() => {
        result.current.setSize(80);
      });

      expect(result.current.size).toBe(70);
    });

    it("clamps to minSize", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "clamp-min",
          defaultSize: 40,
          minSize: 20,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.setSize(5);
      });

      expect(result.current.size).toBe(20);
    });

    it("calls onResize callback", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useSplitPane({
          id: "callback-test",
          defaultSize: 40,
          minSize: 10,
          maxSize: 90,
          onResize,
        }),
      );

      act(() => {
        result.current.setSize(55);
      });

      expect(onResize).toHaveBeenCalledWith(55);
    });
  });

  describe("resetToDefault", () => {
    it("resets to defaultSize", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "reset-test",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.setSize(75);
      });
      expect(result.current.size).toBe(75);

      act(() => {
        result.current.resetToDefault();
      });
      expect(result.current.size).toBe(50);
    });

    it("persists reset value to localStorage", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "reset-persist",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.setSize(80);
      });
      act(() => {
        result.current.resetToDefault();
      });

      expect(localStorage.getItem(`${STORAGE_PREFIX}reset-persist`)).toBe("50");
    });

    it("calls onResize on reset", () => {
      const onResize = vi.fn();
      const { result } = renderHook(() =>
        useSplitPane({
          id: "reset-callback",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          onResize,
        }),
      );

      act(() => {
        result.current.resetToDefault();
      });

      expect(onResize).toHaveBeenCalledWith(50);
    });
  });

  describe("handleDragStart / handleDragEnd", () => {
    it("sets isDragging to true on start", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "drag-test",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      expect(result.current.isDragging).toBe(false);

      act(() => {
        result.current.handleDragStart();
      });

      expect(result.current.isDragging).toBe(true);
    });

    it("sets isDragging to false on end", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "drag-test2",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.handleDragStart();
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handleDragEnd();
      });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("handleDragMove", () => {
    it("computes size from horizontal container rect", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "move-h",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "horizontal",
        }),
      );

      const rect = DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 });

      act(() => {
        result.current.handleDragMove(300, 0, rect);
      });

      expect(result.current.size).toBe(30);
    });

    it("computes size from vertical container rect", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "move-v",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "vertical",
        }),
      );

      const rect = DOMRect.fromRect({ x: 0, y: 0, width: 600, height: 1000 });

      act(() => {
        result.current.handleDragMove(0, 400, rect);
      });

      expect(result.current.size).toBe(40);
    });
  });

  describe("handleKeyDown", () => {
    it("increases size by 5% on ArrowRight (horizontal)", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-h",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "horizontal",
        }),
      );

      act(() => {
        result.current.handleKeyDown("ArrowRight");
      });

      expect(result.current.size).toBe(55);
    });

    it("decreases size by 5% on ArrowLeft (horizontal)", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-h2",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "horizontal",
        }),
      );

      act(() => {
        result.current.handleKeyDown("ArrowLeft");
      });

      expect(result.current.size).toBe(45);
    });

    it("increases size by 5% on ArrowDown (vertical)", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-v",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "vertical",
        }),
      );

      act(() => {
        result.current.handleKeyDown("ArrowDown");
      });

      expect(result.current.size).toBe(55);
    });

    it("decreases size by 5% on ArrowUp (vertical)", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-v2",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
          direction: "vertical",
        }),
      );

      act(() => {
        result.current.handleKeyDown("ArrowUp");
      });

      expect(result.current.size).toBe(45);
    });

    it("resets to default on Enter", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-enter",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.setSize(80);
      });
      expect(result.current.size).toBe(80);

      act(() => {
        result.current.handleKeyDown("Enter");
      });
      expect(result.current.size).toBe(50);
    });

    it("ignores irrelevant keys", () => {
      const { result } = renderHook(() =>
        useSplitPane({
          id: "key-ignore",
          defaultSize: 50,
          minSize: 10,
          maxSize: 90,
        }),
      );

      act(() => {
        result.current.handleKeyDown("Escape");
      });

      expect(result.current.size).toBe(50);
    });
  });
});
