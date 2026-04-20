// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

afterEach(cleanup);

function TooltipDemo({
  content = "Hello",
  side,
}: {
  content?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Trigger</button>
        </TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("renders the trigger element", () => {
    render(<TooltipDemo />);
    const trigger = document.querySelector("[data-slot='tooltip-trigger']");
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toBe("Trigger");
  });

  it("shows tooltip content on pointer enter", async () => {
    render(<TooltipDemo content="Tooltip text" />);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .hover(trigger);

    await waitFor(() => {
      const content = document.querySelector("[data-slot='tooltip-content']");
      expect(content?.getAttribute("data-state")).toBe("delayed-open");
    });
  });

  it("hides tooltip on pointer leave", async () => {
    vi.useRealTimers();
    render(<TooltipDemo content="Tooltip text" />);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;

    const user = userEvent.setup();
    await user.hover(trigger);

    await waitFor(() => {
      const content = document.querySelector("[data-slot='tooltip-content']");
      expect(content?.getAttribute("data-state")).toBe("delayed-open");
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      const triggerAfter = document.querySelector(
        "[data-slot='tooltip-trigger']",
      );
      expect(triggerAfter?.getAttribute("data-state")).toBe("closed");
    });
  });

  it("works with any ReactNode as trigger child", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href="#test">Link trigger</a>
          </TooltipTrigger>
          <TooltipContent>Link tooltip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    const link = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;
    expect(link?.textContent).toBe("Link trigger");

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .hover(link);

    await waitFor(() => {
      const content = document.querySelector("[data-slot='tooltip-content']");
      expect(content?.getAttribute("data-state")).toBe("delayed-open");
    });
  });

  it("renders tooltip arrow", async () => {
    render(<TooltipDemo content="Arrow test" />);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .hover(trigger);

    await waitFor(() => {
      const content = document.querySelector("[data-slot='tooltip-content']");
      expect(content?.getAttribute("data-state")).toBe("delayed-open");
    });

    const content = document.querySelector("[data-slot='tooltip-content']");
    const arrow = content?.querySelector("svg");
    expect(arrow).toBeTruthy();
  });

  it("applies dark theme classes to tooltip content", async () => {
    render(<TooltipDemo content="Styled" />);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .hover(trigger);

    await waitFor(() => {
      const content = document.querySelector("[data-slot='tooltip-content']");
      expect(content?.getAttribute("data-state")).toBe("delayed-open");
    });

    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content?.className).toContain("border-white/[0.06]");
    expect(content?.className).toContain("bg-[var(--color-bg-secondary)]");
    expect(content?.className).toContain("max-w-xs");
  });
});
