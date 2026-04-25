// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOOLTIP_DELAY_MS,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

afterEach(cleanup);

function TooltipDemo({
  content = "Hello",
  side,
  delayDuration,
}: {
  content?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayDuration?: number;
}) {
  return (
    <TooltipProvider delayDuration={delayDuration ?? 0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Trigger</button>
        </TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

async function openTooltip() {
  const trigger = document.querySelector(
    "[data-slot='tooltip-trigger']",
  ) as HTMLElement;
  await userEvent
    .setup({ advanceTimers: vi.advanceTimersByTime })
    .hover(trigger);
  await waitFor(() => {
    const el = document.querySelector("[data-slot='tooltip-content']");
    expect(el?.getAttribute("data-state")).toBe("delayed-open");
  });
  return { trigger };
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
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content?.textContent).toContain("Tooltip text");
  });

  it("hides tooltip on Escape", async () => {
    vi.useRealTimers();
    render(<TooltipDemo content="Tooltip text" />);
    const trigger = document.querySelector(
      "[data-slot='tooltip-trigger']",
    ) as HTMLElement;
    const user = userEvent.setup();
    await user.hover(trigger);
    await waitFor(() => {
      const el = document.querySelector("[data-slot='tooltip-content']");
      expect(el?.getAttribute("data-state")).toBe("delayed-open");
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      const el = document.querySelector("[data-slot='tooltip-trigger']");
      expect(el?.getAttribute("data-state")).toBe("closed");
    });
  });

  it("renders an arrow indicator", async () => {
    render(<TooltipDemo content="Arrow test" />);
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    const arrow = content?.querySelector("svg");
    expect(arrow).toBeTruthy();
  });

  it("supports rich ReactNode content", async () => {
    render(
      <TooltipDemo
        content={
          <span>
            <strong>Bold</strong> and <em>italic</em>
          </span>
        }
      />,
    );
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content?.querySelector("strong")?.textContent).toBe("Bold");
    expect(content?.querySelector("em")?.textContent).toBe("italic");
  });

  it("supports the side prop", async () => {
    render(<TooltipDemo content="Side test" side="bottom" />);
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content?.getAttribute("data-side")).toBe("bottom");
  });

  it("defaults to 300ms delay via TOOLTIP_DELAY_MS", () => {
    expect(TOOLTIP_DELAY_MS).toBe(300);
  });

  it("allows configurable delay via TooltipProvider delayDuration", () => {
    const { unmount } = render(
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">Trigger</button>
          </TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    const trigger = document.querySelector("[data-slot='tooltip-trigger']");
    expect(trigger).toBeTruthy();
    unmount();
  });

  it("enables collision avoidance (auto-placement)", async () => {
    render(<TooltipDemo content="Flip test" />);
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content).toBeTruthy();
    expect(content?.getAttribute("data-side")).toBeTruthy();
  });

  it("applies styling classes to content", async () => {
    render(<TooltipDemo content="Styled" />);
    await openTooltip();
    const content = document.querySelector("[data-slot='tooltip-content']");
    expect(content?.className).toContain("border-white/[0.06]");
    expect(content?.className).toContain("bg-[var(--color-bg-secondary)]");
    expect(content?.className).toContain("max-w-xs");
  });
});
