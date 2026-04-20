// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlockCode } from "./code-block";

// Shiki `codeToHtml` is async; keep it deterministic and fast for tests.
vi.mock("shiki", () => ({
  codeToHtml: vi.fn(async (code: string) => `<pre><code>${code}</code></pre>`),
}));

describe("CodeBlockCode", () => {
  beforeEach(() => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a language label badge", () => {
    render(<CodeBlockCode code={"const x = 1"} language="typescript" />);
    const header = screen.getByTestId("code-block-header");
    expect(header.textContent?.toLowerCase()).toContain("typescript");
  });

  it("calls navigator.clipboard.writeText and shows Copied! transient", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CodeBlockCode code={"hello world"} language="ts" />);
    const copyButton = screen.getByRole("button", { name: /copy code/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("hello world");
    });
    await screen.findByText("Copied!");
  });

  it("does not render line numbers by default", () => {
    render(<CodeBlockCode code={"a\nb\nc"} language="ts" />);
    expect(screen.queryByTestId("code-block-line-numbers")).toBeNull();
  });

  it("renders line numbers when showLineNumbers is true", () => {
    render(
      <CodeBlockCode code={"a\nb\nc"} language="ts" showLineNumbers={true} />,
    );
    const lineNumbers = screen.getByTestId("code-block-line-numbers");
    expect(lineNumbers.textContent).toContain("1");
    expect(lineNumbers.textContent).toContain("2");
    expect(lineNumbers.textContent).toContain("3");
  });
});
