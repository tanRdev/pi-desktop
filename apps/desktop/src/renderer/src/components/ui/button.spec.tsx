// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button accessibility", () => {
  it("includes a focus-visible ring class", () => {
    const { getByRole } = render(<Button>Click me</Button>);
    const btn = getByRole("button");
    expect(btn.className).toContain("focus-visible:ring-2");
  });

  describe("icon-only accessibility warning", () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it("warns when an icon-only button has no accessible name", () => {
      render(
        <Button size="icon">
          <svg aria-hidden="true" />
        </Button>,
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Icon-only button is missing"),
      );
    });

    it("does not warn when aria-label is provided", () => {
      render(
        <Button size="icon" aria-label="Close">
          <svg aria-hidden="true" />
        </Button>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not warn when text children are provided", () => {
      render(<Button size="icon">x</Button>);
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not warn for non-icon sizes without aria-label", () => {
      render(
        <Button>
          <svg aria-hidden="true" />
        </Button>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
