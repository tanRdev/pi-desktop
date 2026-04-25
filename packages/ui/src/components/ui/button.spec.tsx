// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Button", () => {
  it("renders default styles and data attributes", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    expect(button).toHaveAttribute("data-size", "default");
    expect(button.className).toContain("inline-flex");
    expect(button.className).toContain("bg-white/[0.75]");
  });

  it("supports asChild composition", () => {
    render(
      <Button asChild variant="ghost">
        <a href="/docs">Docs</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Docs" });

    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveAttribute("data-variant", "ghost");
    expect(link.className).toContain("hover:bg-white/[0.06]");
  });

  it("warns when an icon-only button is missing an accessible name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <Button size="icon">
        <svg aria-hidden="true" />
      </Button>,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Icon-only button is missing an accessible name"),
    );
  });

  it("does not warn when an icon-only button has an aria-label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <Button size="icon" aria-label="Refresh">
        <svg aria-hidden="true" />
      </Button>,
    );

    expect(warn).not.toHaveBeenCalled();
  });
});
