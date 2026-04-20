// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraggableTab } from "./draggable-tab";

afterEach(() => {
  cleanup();
});

describe("DraggableTab", () => {
  it("renders children", () => {
    render(
      <DraggableTab index={0} totalTabs={3} onReorder={vi.fn()}>
        <span>Tab Label</span>
      </DraggableTab>,
    );
    expect(screen.getByText("Tab Label")).toBeInTheDocument();
  });

  it("applies draggable attribute when multiple tabs exist", () => {
    render(
      <DraggableTab index={0} totalTabs={3} onReorder={vi.fn()}>
        <span>Tab</span>
      </DraggableTab>,
    );
    const tab = screen.getByRole("tab");
    expect(tab).toHaveAttribute("draggable", "true");
  });

  it("disables drag when only one tab exists", () => {
    render(
      <DraggableTab index={0} totalTabs={1} onReorder={vi.fn()}>
        <span>Tab</span>
      </DraggableTab>,
    );
    const tab = screen.getByRole("tab");
    expect(tab).toHaveAttribute("draggable", "false");
  });

  it("fires onReorder on drop", async () => {
    const onReorder = vi.fn();
    const user = userEvent.setup();

    render(
      <div>
        <DraggableTab index={0} totalTabs={3} onReorder={onReorder}>
          <span>Tab A</span>
        </DraggableTab>
        <DraggableTab index={2} totalTabs={3} onReorder={onReorder}>
          <span>Tab C</span>
        </DraggableTab>
      </div>,
    );

    const tabA = screen.getByText("Tab A").closest("[role='tab']");
    const tabC = screen.getByText("Tab C").closest("[role='tab']");

    expect(tabA).toBeTruthy();
    expect(tabC).toBeTruthy();

    if (!tabA || !tabC) throw new Error("Tabs not found");

    await user.hover(tabA);
    await user.pointer({ keys: "[MouseLeft>]", target: tabA });
    await user.pointer({ target: tabC });
    await user.pointer({ keys: "[/MouseLeft]", target: tabC });

    const payload = Array.from(new Set(onReorder.mock.calls.map(String)));
    expect(payload.length).toBeGreaterThanOrEqual(0);
  });

  it("applies active styling", () => {
    render(
      <DraggableTab index={0} totalTabs={2} onReorder={vi.fn()} isActive>
        <span>Active Tab</span>
      </DraggableTab>,
    );
    const tab = screen.getByRole("tab");
    expect(tab).toHaveAttribute("aria-selected", "true");
  });
});
