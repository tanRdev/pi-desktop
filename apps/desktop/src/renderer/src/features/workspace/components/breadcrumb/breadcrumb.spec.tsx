// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "./breadcrumb";

vi.mock("@/components/ui/icons", () => {
  const React = require("react");
  const Stub = (props: Record<string, unknown>) =>
    React.createElement("span", props);
  return { CaretRight: Stub, Copy: Stub, Export: Stub };
});

vi.mock("@/components/ui/popover", () => {
  const React = require("react");
  return {
    Popover: ({ children }: { children: React.ReactNode }) => children,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
    PopoverContent: ({
      children,
    }: {
      children: React.ReactNode;
      className?: string;
      align?: string;
    }) => <div data-testid="popover-content">{children}</div>,
  };
});

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
});

describe("Breadcrumb", () => {
  it("renders nothing when filePath is null", () => {
    const { container } = render(<Breadcrumb filePath={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all segments for a short path", () => {
    render(<Breadcrumb filePath="/src/App.tsx" />);

    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
  });

  it("makes the last segment bold and not a button", () => {
    render(<Breadcrumb filePath="/src/App.tsx" />);

    const lastSegment = screen.getByTestId("breadcrumb-segment-last");
    expect(lastSegment.tagName).toBe("SPAN");
    expect(lastSegment).toHaveTextContent("App.tsx");
  });

  it("clickable segments call onNavigate", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(
      <Breadcrumb
        filePath="/src/components/Button.tsx"
        onNavigate={onNavigate}
      />,
    );

    const segments = screen.getAllByTestId("breadcrumb-segment");
    const first = segments[0];
    if (!first) throw new Error("No segments");
    await user.click(first);
    expect(onNavigate).toHaveBeenCalledWith("src");
  });

  it("shows overflow indicator when depth > 4", () => {
    render(<Breadcrumb filePath="/a/b/c/d/e/f.ts" />);

    expect(screen.getByTestId("breadcrumb-overflow")).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("does not show overflow for depth <= 4", () => {
    render(<Breadcrumb filePath="/a/b/c/d.ts" />);

    expect(screen.queryByTestId("breadcrumb-overflow")).not.toBeInTheDocument();
  });

  it("shows first and last segments when overflow is present", () => {
    render(<Breadcrumb filePath="/a/b/c/d/e/f.ts" />);

    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("f.ts")).toBeInTheDocument();
  });

  it("navigates with keyboard ArrowRight/ArrowLeft and Enter", () => {
    const onNavigate = vi.fn();

    render(<Breadcrumb filePath="/src/App.tsx" onNavigate={onNavigate} />);

    const nav = screen.getByTestId("breadcrumb");
    fireEvent.focus(nav);
    fireEvent.keyDown(nav, { key: "ArrowRight" });
    fireEvent.keyDown(nav, { key: "Enter" });

    expect(onNavigate).toHaveBeenCalledWith("src");
  });

  it("does not navigate on Enter for the last segment", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<Breadcrumb filePath="/src/App.tsx" onNavigate={onNavigate} />);

    const nav = screen.getByTestId("breadcrumb");
    nav.focus();

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("shows context menu on right-click", async () => {
    const user = userEvent.setup();

    render(<Breadcrumb filePath="/src/App.tsx" />);

    const segment = screen.getAllByTestId("breadcrumb-segment")[0];
    await user.pointer({ keys: "[MouseRight]", target: segment });

    expect(
      screen.getByRole("menu", { name: "Breadcrumb actions" }),
    ).toBeInTheDocument();
  });

  it("context menu contains Copy Path and Reveal in Finder", async () => {
    const user = userEvent.setup();

    render(<Breadcrumb filePath="/src/App.tsx" />);

    const segment = screen.getAllByTestId("breadcrumb-segment")[0];
    await user.pointer({ keys: "[MouseRight]", target: segment });

    const menu = screen.getByRole("menu", { name: "Breadcrumb actions" });
    expect(within(menu).getByText("Copy Path")).toBeInTheDocument();
    expect(within(menu).getByText("Reveal in Finder")).toBeInTheDocument();
  });
});
