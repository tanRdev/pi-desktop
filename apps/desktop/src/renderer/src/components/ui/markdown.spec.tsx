// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "./markdown";

// Avoid the async shiki pipeline by stubbing CodeBlockCode isn't needed — the
// component shows plain code before highlighting. We only exercise markdown.

vi.mock("./code-block", () => ({
  CodeBlockCode: ({ code, language }: { code: string; language: string }) => (
    <pre data-testid="cb" data-language={language}>
      {code}
    </pre>
  ),
}));

describe("Markdown hardening", () => {
  afterEach(() => {
    cleanup();
  });
  it("adds target=_blank and rel=noopener noreferrer on external links", () => {
    render(<Markdown>{"[ext](https://example.com)"}</Markdown>);
    const link = screen.getByRole("link", { name: "ext" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("does not set target/rel on hash or relative links", () => {
    render(<Markdown>{"[frag](#section)"}</Markdown>);
    const link = screen.getByRole("link", { name: "frag" });
    expect(link.getAttribute("target")).toBeNull();
    expect(link.getAttribute("rel")).toBeNull();
    expect(link.getAttribute("href")).toBe("#section");
  });

  it("strips javascript: URLs from links", () => {
    const { container } = render(
      <Markdown>{"[bad](javascript:alert(1))"}</Markdown>,
    );
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    const href = link?.getAttribute("href");
    // Either no href or a safe placeholder; must not be a javascript: URL.
    expect(href?.startsWith("javascript:")).not.toBe(true);
  });

  it("renders deterministic slug id on headings", () => {
    const { container } = render(
      <Markdown>{"# Hello World Heading!"}</Markdown>,
    );
    const h1 = container.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1?.getAttribute("id")).toBe("hello-world-heading");
  });

  it("emits images with loading=lazy and decoding=async", () => {
    const { container } = render(
      <Markdown>{"![alt](https://example.com/x.png)"}</Markdown>,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("decoding")).toBe("async");
    expect(img?.getAttribute("src")).toBe("https://example.com/x.png");
  });

  it("drops image with javascript: src", () => {
    const { container } = render(
      <Markdown>{"![alt](javascript:alert(1))"}</Markdown>,
    );
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });

  it("allows image data: URIs", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const { container } = render(<Markdown>{`![alt](${dataUri})`}</Markdown>);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(dataUri);
  });
});
