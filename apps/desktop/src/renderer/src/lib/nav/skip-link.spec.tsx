// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("is hidden by default (positioned off-screen)", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.style.top).toBe("-100px");
  });

  it("becomes visible on focus", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    if (!link) throw new Error("No link element");
    fireEvent.focus(link);
    expect(link.style.top).toBe("0px");
  });

  it("hides again on blur", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    if (!link) throw new Error("No link element");
    fireEvent.focus(link);
    expect(link.style.top).toBe("0px");
    fireEvent.blur(link);
    expect(link.style.top).toBe("-100px");
  });

  it("links to #main-content by default", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("#main-content");
  });

  it("links to custom target id", () => {
    const { container } = render(<SkipLink targetId="custom-target" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("#custom-target");
  });

  it("renders custom label text", () => {
    const { container } = render(<SkipLink label="Jump to content" />);
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("Jump to content");
  });

  it("renders default label text", () => {
    const { container } = render(<SkipLink />);
    const link = container.querySelector("a");
    expect(link?.textContent).toBe("Skip to main content");
  });
});
