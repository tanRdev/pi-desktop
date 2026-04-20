// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SplitPane } from "./split-pane";
import {
  NestedSplitPane,
  SplitPaneGroup,
  SplitPaneItem,
} from "./split-pane-group";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderSplitPane(
  overrides: Partial<Parameters<typeof SplitPane>[0]> = {},
) {
  return render(
    <SplitPane defaultSize={50} minSize={10} maxSize={90} {...overrides}>
      <div data-testid="pane-primary">Primary</div>
      <div data-testid="pane-secondary">Secondary</div>
    </SplitPane>,
  );
}

describe("SplitPane", () => {
  it("renders two panes and a divider", () => {
    renderSplitPane();
    expect(screen.getByTestId("pane-primary")).toBeTruthy();
    expect(screen.getByTestId("pane-secondary")).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
  });

  it("applies horizontal flex-row by default", () => {
    renderSplitPane();
    const container = screen.getByRole("separator").parentElement;
    if (!container) throw new Error("No parent element");
    expect(container.dataset.orientation).toBe("horizontal");
    expect(container.className).toContain("flex-row");
  });

  it("applies vertical flex-col when orientation=vertical", () => {
    renderSplitPane({ orientation: "vertical" });
    const container = screen.getByRole("separator").parentElement;
    if (!container) throw new Error("No parent element");
    expect(container.dataset.orientation).toBe("vertical");
    expect(container.className).toContain("flex-col");
  });

  it("sets primary flexBasis as percentage of defaultSize", () => {
    renderSplitPane({ defaultSize: 30 });
    const primary = screen.getByTestId("pane-primary").parentElement;
    if (!primary) throw new Error("No parent element");
    const style = primary.getAttribute("style") ?? "";
    expect(style).toContain("flex: 0 0 30%");
  });

  it("shows col-resize cursor for horizontal split", () => {
    renderSplitPane();
    const divider = screen.getByRole("separator");
    expect(divider.className).toContain("cursor-col-resize");
  });

  it("shows row-resize cursor for vertical split", () => {
    renderSplitPane({ orientation: "vertical" });
    const divider = screen.getByRole("separator");
    expect(divider.className).toContain("cursor-row-resize");
  });

  describe("keyboard resize", () => {
    it("resizes by 1% on ArrowRight", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(onResize).toHaveBeenCalledWith(51);
    });

    it("resizes by 1% on ArrowLeft", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowLeft" });
      expect(onResize).toHaveBeenCalledWith(49);
    });

    it("resizes by 10% on Shift+ArrowRight", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight", shiftKey: true });
      expect(onResize).toHaveBeenCalledWith(60);
    });

    it("respects maxSize constraint on keyboard resize", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 85, maxSize: 90 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight", shiftKey: true });
      expect(onResize).toHaveBeenCalledWith(90);
    });

    it("respects minSize constraint on keyboard resize", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 15, minSize: 10 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowLeft", shiftKey: true });
      expect(onResize).toHaveBeenCalledWith(10);
    });

    it("uses ArrowUp/ArrowDown for vertical orientation", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, orientation: "vertical", defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowDown" });
      expect(onResize).toHaveBeenCalledWith(51);
      fireEvent.keyDown(divider, { key: "ArrowUp" });
      expect(onResize).toHaveBeenCalledWith(50);
    });
  });

  describe("double-click collapse", () => {
    it("collapses primary pane on double-click", () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.doubleClick(divider);
      expect(onResize).toHaveBeenCalledWith(0);
    });

    it.skip("expands primary pane on second double-click", async () => {
      const onResize = vi.fn();
      renderSplitPane({ onResize, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.doubleClick(divider);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      fireEvent.doubleClick(divider);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(onResize).toHaveBeenCalledWith(0);
      expect(onResize).toHaveBeenLastCalledWith(50);
    });
  });

  describe("persistence", () => {
    it("persists size to localStorage on resize", () => {
      const key = "test-split-pane";
      renderSplitPane({ persistenceKey: key, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.keyDown(divider, { key: "ArrowRight" });
      expect(localStorage.getItem(key)).toBe("51");
    });

    it("persists collapsed size to localStorage", () => {
      const key = "test-split-pane-collapse";
      renderSplitPane({ persistenceKey: key, defaultSize: 50 });
      const divider = screen.getByRole("separator");
      fireEvent.doubleClick(divider);
      expect(localStorage.getItem(key)).toBe("0");
    });

    it("restores size from localStorage on mount", () => {
      localStorage.setItem("persisted-key", "70");
      renderSplitPane({ persistenceKey: "persisted-key", defaultSize: 50 });
      const primary = screen.getByTestId("pane-primary").parentElement;
      if (!primary) throw new Error("No parent element");
      const style = primary.getAttribute("style") ?? "";
      expect(style).toContain("flex: 0 0 70%");
    });

    it("clamps restored size to current min/max constraints", () => {
      localStorage.setItem("clamp-key", "95");
      renderSplitPane({
        persistenceKey: "clamp-key",
        defaultSize: 50,
        maxSize: 90,
      });
      const primary = screen.getByTestId("pane-primary").parentElement;
      if (!primary) throw new Error("No parent element");
      const style = primary.getAttribute("style") ?? "";
      expect(style).toContain("flex: 0 0 90%");
    });

    it("clamps restored size to current min/max constraints", () => {
      localStorage.setItem("clamp-key", "95");
      renderSplitPane({
        persistenceKey: "clamp-key",
        defaultSize: 50,
        maxSize: 90,
      });
      const primary = screen.getByTestId("pane-primary").parentElement;
      if (!primary) throw new Error("No parent element");
      expect(primary.style.flexBasis).toBe("90%");
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

describe("SplitPaneGroup", () => {
  it("renders nested split panes recursively", () => {
    render(
      <SplitPaneGroup orientation="horizontal">
        <NestedSplitPane id="outer" orientation="horizontal" defaultSize={50}>
          <SplitPaneItem id="left">
            <div data-testid="left">Left</div>
          </SplitPaneItem>
          <NestedSplitPane id="inner" orientation="vertical" defaultSize={60}>
            <SplitPaneItem id="top-right">
              <div data-testid="top-right">Top Right</div>
            </SplitPaneItem>
            <SplitPaneItem id="bottom-right">
              <div data-testid="bottom-right">Bottom Right</div>
            </SplitPaneItem>
          </NestedSplitPane>
        </NestedSplitPane>
      </SplitPaneGroup>,
    );
    expect(screen.getByTestId("left")).toBeTruthy();
    expect(screen.getByTestId("top-right")).toBeTruthy();
    expect(screen.getByTestId("bottom-right")).toBeTruthy();
  });

  it("tracks focus within the group", () => {
    render(
      <SplitPaneGroup orientation="horizontal">
        <SplitPaneItem id="panel-a">
          <input data-testid="input-a" />
        </SplitPaneItem>
        <SplitPaneItem id="panel-b">
          <input data-testid="input-b" />
        </SplitPaneItem>
      </SplitPaneGroup>,
    );
    const inputB = screen.getByTestId("input-b");
    fireEvent.focus(inputB);
    const panelB = screen.getByTestId("input-b").closest("[data-pane-id]");
    expect(panelB?.getAttribute("data-focused")).toBe("true");

    const panelA = screen.getByTestId("input-a").closest("[data-pane-id]");
    expect(panelA?.getAttribute("data-focused")).toBeNull();
  });
});
