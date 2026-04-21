// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SplitPane } from "./split-pane";

const STORAGE_PREFIX = "pi-desktop:split-pane:";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderSplitPane(
  overrides: Partial<Omit<Parameters<typeof SplitPane>[0], "children">> = {},
) {
  return render(
    <SplitPane
      id="test"
      defaultSize={50}
      minSize={10}
      maxSize={90}
      {...overrides}
    >
      <div data-testid="pane-primary">Primary</div>
      <div data-testid="pane-secondary">Secondary</div>
    </SplitPane>,
  );
}

describe("SplitPane", () => {
  it("renders two children", () => {
    renderSplitPane();
    expect(screen.getByTestId("pane-primary")).toBeTruthy();
    expect(screen.getByTestId("pane-secondary")).toBeTruthy();
  });

  it("renders a visible divider with separator role", () => {
    renderSplitPane();
    const divider = screen.getByRole("separator");
    expect(divider).toBeTruthy();
    expect(
      divider.style.width === "4px" || divider.style.height === "4px",
    ).toBe(true);
  });

  it("shows col-resize cursor for horizontal direction", () => {
    renderSplitPane();
    const divider = screen.getByRole("separator");
    expect(divider.className).toContain("cursor-col-resize");
  });

  it("shows row-resize cursor for vertical direction", () => {
    renderSplitPane({ direction: "vertical" });
    const divider = screen.getByRole("separator");
    expect(divider.className).toContain("cursor-row-resize");
  });

  it("applies horizontal flex-row by default", () => {
    renderSplitPane();
    const container = screen.getByRole("separator").parentElement;
    if (!container) throw new Error("No parent element");
    expect(container.dataset.direction).toBe("horizontal");
    expect(container.className).toContain("flex-row");
  });

  it("applies vertical flex-col when direction=vertical", () => {
    renderSplitPane({ direction: "vertical" });
    const container = screen.getByRole("separator").parentElement;
    if (!container) throw new Error("No parent element");
    expect(container.dataset.direction).toBe("vertical");
    expect(container.className).toContain("flex-col");
  });

  it("sets primary flexBasis as percentage of defaultSize", () => {
    renderSplitPane({ defaultSize: 30 });
    const container = screen.getByRole("separator").parentElement;
    if (!container) throw new Error("No parent element");
    const primary = container.querySelector('[data-slot="split-pane-primary"]');
    if (!primary) throw new Error("No primary element");
    expect(primary.getAttribute("style")).toContain("30%");
  });

  it("divider has transition-colors duration-150", () => {
    renderSplitPane();
    const divider = screen.getByRole("separator");
    expect(divider.className).toContain("transition-colors");
    expect(divider.className).toContain("duration-150");
  });

  describe("drag interaction", () => {
    it("fires pointer capture on pointer down", () => {
      renderSplitPane();
      const divider = screen.getByRole("separator");
      const setPointerCapture = vi.fn();
      divider.setPointerCapture = setPointerCapture;
      fireEvent.pointerDown(divider, {
        pointerId: 1,
        clientX: 100,
        clientY: 50,
      });
      expect(setPointerCapture).toHaveBeenCalledWith(1);
    });

    it("calls onResize during drag", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });

      const container = screen.getByRole("separator").parentElement;
      if (!container) throw new Error("No parent element");
      container.getBoundingClientRect = vi.fn(() =>
        DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 }),
      );

      const divider = screen.getByRole("separator");
      divider.setPointerCapture = vi.fn();

      fireEvent.pointerDown(divider, {
        pointerId: 1,
        clientX: 100,
        clientY: 50,
      });
      fireEvent.pointerMove(container, { clientX: 300, clientY: 50 });

      expect(onResize).toHaveBeenCalled();
    });
  });

  describe("keyboard resize", () => {
    it("resizes by 5% on ArrowRight", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(onResize).toHaveBeenCalledWith(55);
    });

    it("resizes by 5% on ArrowLeft", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowLeft" });
      expect(onResize).toHaveBeenCalledWith(45);
    });

    it("uses ArrowUp/Down for vertical orientation", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, direction: "vertical", defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowDown" });
      expect(onResize).toHaveBeenCalledWith(55);
      fireEvent.keyDown(divider, { key: "ArrowUp" });
      expect(onResize).toHaveBeenLastCalledWith(50);
    });

    it("resets to default on Enter", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");

      fireEvent.keyDown(divider, { key: "ArrowRight" });
      fireEvent.keyDown(divider, { key: "Enter" });

      expect(onResize).toHaveBeenLastCalledWith(50);
    });
  });

  describe("double-click reset", () => {
    it("resets to default on double-click", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");

      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(onResize).toHaveBeenCalledWith(55);

      fireEvent.doubleClick(divider);
      expect(onResize).toHaveBeenLastCalledWith(50);
    });
  });

  describe("persistence", () => {
    it("persists size to localStorage on keyboard resize", () => {
      renderSplitPane({ id: "persist-test", defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(localStorage.getItem(`${STORAGE_PREFIX}persist-test`)).toBe("55");
    });

    it("restores size from localStorage on mount", () => {
      localStorage.setItem(`${STORAGE_PREFIX}mount-test`, "70");
      renderSplitPane({ id: "mount-test", defaultSize: 50 });
      const container = screen.getByRole("separator").parentElement;
      if (!container) throw new Error("No parent element");
      const primary = container.querySelector(
        '[data-slot="split-pane-primary"]',
      );
      if (!primary) throw new Error("No primary element");
      expect(primary.getAttribute("style")).toContain("70%");
    });

    it("clamps restored size to maxSize", () => {
      localStorage.setItem(`${STORAGE_PREFIX}clamp-test`, "95");
      renderSplitPane({ id: "clamp-test", defaultSize: 50, maxSize: 80 });
      const container = screen.getByRole("separator").parentElement;
      if (!container) throw new Error("No parent element");
      const primary = container.querySelector(
        '[data-slot="split-pane-primary"]',
      );
      if (!primary) throw new Error("No primary element");
      expect(primary.getAttribute("style")).toContain("80%");
    });
  });

  describe("accessibility", () => {
    it("has separator role with aria attributes", () => {
      renderSplitPane({ defaultSize: 50, minSize: 10, maxSize: 90 });
      const divider = screen.getByRole("separator");
      expect(divider.getAttribute("aria-orientation")).toBe("horizontal");
      expect(divider.getAttribute("aria-valuenow")).toBe("50");
      expect(divider.getAttribute("aria-valuemin")).toBe("10");
      expect(divider.getAttribute("aria-valuemax")).toBe("90");
    });

    it("is focusable with tabIndex", () => {
      renderSplitPane();
      const divider = screen.getByRole("separator");
      expect(divider.tabIndex).toBe(0);
    });
  });
});
