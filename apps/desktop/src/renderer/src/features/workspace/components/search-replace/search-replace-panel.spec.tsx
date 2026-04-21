// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchReplacePanel } from "./search-replace-panel";

afterEach(() => {
  cleanup();
});

const TEST_FILES = [
  {
    filePath: "src/index.ts",
    content: "export const hello = 'world';\nconsole.log(hello);",
  },
  {
    filePath: "src/utils.ts",
    content: "function hello() { return 'hi'; }\n// hello comment",
  },
  { filePath: "README.md", content: "# Hello World\nThis is the readme." },
];

describe("SearchReplacePanel", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(
      <SearchReplacePanel
        open={false}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders search input when open", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("shows no results for empty query", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    expect(screen.queryByTestId("search-results")).not.toBeInTheDocument();
  });

  it("shows results after typing a search pattern", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(screen.getByTestId("search-results")).toBeInTheDocument();
  });

  it("shows no results message when pattern has no matches", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "xyznoexist" } });
    expect(screen.getByTestId("search-no-results")).toBeInTheDocument();
  });

  it("toggles regex mode", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    const regexBtn = screen.getByTestId("toggle-regex");
    fireEvent.click(regexBtn);
    expect(regexBtn).toBeInTheDocument();
  });

  it("toggles case sensitive mode", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    const caseBtn = screen.getByTestId("toggle-case-sensitive");
    fireEvent.click(caseBtn);
    expect(caseBtn).toBeInTheDocument();
  });

  it("shows replace input when replace is toggled", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    expect(screen.queryByTestId("replace-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("toggle-replace"));
    expect(screen.getByTestId("replace-input")).toBeInTheDocument();
  });

  it("shows file filter input when filter is toggled", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    expect(screen.queryByTestId("file-filter-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("toggle-file-filter"));
    expect(screen.getByTestId("file-filter-input")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={onOpenChange}
        files={TEST_FILES}
      />,
    );
    const input = screen.getByTestId("search-input");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows file type badges in results", () => {
    render(
      <SearchReplacePanel
        open={true}
        onOpenChange={() => {}}
        files={TEST_FILES}
      />,
    );
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "hello" } });
    const badges = document.querySelectorAll(
      "[data-testid^='search-file-group-']",
    );
    expect(badges.length).toBeGreaterThan(0);
  });
});
