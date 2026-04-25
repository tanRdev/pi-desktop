// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTreeItem } from "./file-tree-item";

vi.mock("@/components/ui/phosphor-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Stub = (props: Record<string, unknown>) =>
    React.createElement("span", props);
  return {
    CaretRight: Stub,
    CircleNotch: Stub,
    File: Stub,
    FileCode: Stub,
    FileText: Stub,
    Folder: Stub,
    FolderOpen: Stub,
    Image: Stub,
  };
});

afterEach(() => {
  cleanup();
});

const baseProps = {
  depth: 0,
  isExpanded: false,
  isLoading: false,
  childNodes: null,
  onToggleExpand: vi.fn(),
  onFileSelect: vi.fn(),
  expandedPaths: new Set<string>(),
};

describe("FileTreeItem rename input", () => {
  it("focuses the input on mount", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
      />,
    );

    const input = screen.getByRole("textbox");
    expect(document.activeElement).toBe(input);
  });

  it("selects the basename (excludes extension) on focus", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("foo".length);
  });

  it("selects the full name when there is no extension", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "Makefile", path: "/r/Makefile", type: "file" }}
        isRenaming={true}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Makefile".length);
  });

  it("does not re-steal focus across unrelated parent re-renders", async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();

    const { rerender } = render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
        onToggleExpand={onToggleExpand}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(document.activeElement).toBe(input);

    // User moves focus away (e.g. clicks somewhere else).
    const external = document.createElement("button");
    external.textContent = "outside";
    document.body.appendChild(external);
    external.focus();
    expect(document.activeElement).toBe(external);

    // Parent re-renders with identical props. Old implementation used a ref
    // callback that called focus() on every render, stealing focus back.
    rerender(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
        onToggleExpand={onToggleExpand}
      />,
    );

    expect(document.activeElement).toBe(external);
    document.body.removeChild(external);
    // Keep user-event import alive: confirm no click interactions happened.
    void user;
  });

  it("submits on Enter", async () => {
    const user = userEvent.setup();
    const onRenameSubmit = vi.fn();

    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
        onRenameSubmit={onRenameSubmit}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox");
    await user.clear(input);
    await user.type(input, "bar.ts{Enter}");
    expect(onRenameSubmit).toHaveBeenCalledWith("/r/foo.ts", "bar.ts");
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    const onRenameCancel = vi.fn();

    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "foo.ts", path: "/r/foo.ts", type: "file" }}
        isRenaming={true}
        onRenameCancel={onRenameCancel}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onRenameCancel).toHaveBeenCalled();
  });
});

describe("FileTreeItem git status badge", () => {
  it("renders an 'M' badge for modified files", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="modified"
      />,
    );
    const badge = screen.getByTestId("git-status-badge");
    expect(badge).toHaveTextContent("M");
    expect(badge).toHaveAttribute("title", "git modified");
  });

  it("renders an 'A' badge for added files", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="added"
      />,
    );
    expect(screen.getByTestId("git-status-badge")).toHaveTextContent("A");
  });

  it("renders an 'A' badge for untracked files", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="untracked"
      />,
    );
    expect(screen.getByTestId("git-status-badge")).toHaveTextContent("A");
  });

  it("renders a 'D' badge for deleted files", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="deleted"
      />,
    );
    expect(screen.getByTestId("git-status-badge")).toHaveTextContent("D");
  });

  it("renders an 'R' badge for renamed files", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="renamed"
      />,
    );
    expect(screen.getByTestId("git-status-badge")).toHaveTextContent("R");
  });

  it("renders no badge when gitStatus is absent", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
      />,
    );
    expect(screen.queryByTestId("git-status-badge")).toBeNull();
  });

  it("renders no badge for unsupported statuses", () => {
    render(
      <FileTreeItem
        {...baseProps}
        entry={{ name: "a.ts", path: "/r/a.ts", type: "file" }}
        gitStatus="unknown"
      />,
    );
    expect(screen.queryByTestId("git-status-badge")).toBeNull();
  });
});
