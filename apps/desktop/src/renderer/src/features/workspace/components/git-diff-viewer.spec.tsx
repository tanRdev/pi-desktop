import type { GitDiffLine } from "@pi-desktop/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GitDiffViewer, pairRemoveAddLines } from "./git-diff-viewer";

function makeLine(
  type: GitDiffLine["type"],
  content: string,
  overrides: Partial<GitDiffLine> = {},
): GitDiffLine {
  return {
    type,
    content,
    oldLineNumber: type === "add" ? null : 1,
    newLineNumber: type === "remove" ? null : 1,
    ...overrides,
  };
}

const baseDiff = {
  filePath: "test.ts",
  oldFilePath: null,
  status: "modified" as const,
  binary: false,
  hunks: [
    {
      oldStart: 1,
      oldCount: 3,
      newStart: 1,
      newCount: 3,
      lines: [
        makeLine("context", "unchanged line", {
          oldLineNumber: 1,
          newLineNumber: 1,
        }),
        makeLine("remove", "old code here", {
          oldLineNumber: 2,
          newLineNumber: null,
        }),
        makeLine("add", "new code here", {
          oldLineNumber: null,
          newLineNumber: 2,
        }),
        makeLine("context", "trailing line", {
          oldLineNumber: 3,
          newLineNumber: 3,
        }),
      ],
    },
  ],
};

describe("pairRemoveAddLines", () => {
  it("pairs adjacent remove and add lines", () => {
    const lines: GitDiffLine[] = [
      makeLine("remove", "a"),
      makeLine("add", "b"),
    ];
    const paired = pairRemoveAddLines(lines);
    expect(paired.get(0)).toEqual(lines[1]);
    expect(paired.get(1)).toEqual(lines[0]);
  });

  it("does not pair non-adjacent remove and add lines", () => {
    const lines: GitDiffLine[] = [
      makeLine("remove", "a"),
      makeLine("context", "b"),
      makeLine("add", "c"),
    ];
    const paired = pairRemoveAddLines(lines);
    expect(paired.get(0)).toBeUndefined();
    expect(paired.get(2)).toBeUndefined();
  });

  it("leaves unpaired remove lines without a pair", () => {
    const lines: GitDiffLine[] = [makeLine("remove", "a")];
    const paired = pairRemoveAddLines(lines);
    expect(paired.get(0)).toBeUndefined();
  });

  it("leaves unpaired add lines without a pair", () => {
    const lines: GitDiffLine[] = [makeLine("add", "a")];
    const paired = pairRemoveAddLines(lines);
    expect(paired.get(0)).toBeUndefined();
  });

  it("pairs consecutive remove-add groups separately", () => {
    const lines: GitDiffLine[] = [
      makeLine("remove", "a1"),
      makeLine("add", "b1"),
      makeLine("remove", "a2"),
      makeLine("add", "b2"),
    ];
    const paired = pairRemoveAddLines(lines);
    expect(paired.get(0)).toEqual(lines[1]);
    expect(paired.get(1)).toEqual(lines[0]);
    expect(paired.get(2)).toEqual(lines[3]);
    expect(paired.get(3)).toEqual(lines[2]);
  });
});

describe("GitDiffViewer line coloring", () => {
  it("renders added lines with emerald background", () => {
    const { container } = render(
      <GitDiffViewer diff={baseDiff} onClose={() => {}} />,
    );
    const addRows = container.querySelectorAll(".bg-emerald-500\\/10");
    expect(addRows.length).toBeGreaterThanOrEqual(1);
  });

  it("renders removed lines with red background", () => {
    const { container } = render(
      <GitDiffViewer diff={baseDiff} onClose={() => {}} />,
    );
    const removeRows = container.querySelectorAll(".bg-red-500\\/10");
    expect(removeRows.length).toBeGreaterThanOrEqual(1);
  });

  it("renders context lines with no colored background", () => {
    const { container } = render(
      <GitDiffViewer diff={baseDiff} onClose={() => {}} />,
    );
    const emeraldRows = container.querySelectorAll(".bg-emerald-500\\/10");
    const redRows = container.querySelectorAll(".bg-red-500\\/10");
    expect(emeraldRows.length + redRows.length).toBeGreaterThan(0);
  });

  it("renders + prefix on added lines and - on removed lines", () => {
    render(<GitDiffViewer diff={baseDiff} onClose={() => {}} />);
    expect(screen.getAllByText("+").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("renders hunk header with blue text", () => {
    const { container } = render(
      <GitDiffViewer diff={baseDiff} onClose={() => {}} />,
    );
    const hunkHeaders = container.querySelectorAll(".text-blue-400");
    expect(hunkHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it("renders line numbers with dimmed styling", () => {
    const { container } = render(
      <GitDiffViewer diff={baseDiff} onClose={() => {}} />,
    );
    const lineNumSpans = container.querySelectorAll(".text-white\\/50");
    expect(lineNumSpans.length).toBeGreaterThan(0);
  });
});

describe("GitDiffViewer line selection", () => {
  function findLineRow(container: HTMLElement, text: string): HTMLElement {
    const rows = container.querySelectorAll<HTMLElement>("[data-selected]");
    for (const row of rows) {
      if (row.textContent?.includes(text)) return row;
    }
    throw new Error(`no selectable diff row containing ${text}`);
  }

  it("does not make lines selectable without an ask handler", () => {
    render(<GitDiffViewer diff={baseDiff} onClose={() => {}} />);
    expect(
      screen.queryByRole("button", { name: /Ask about selection/ }),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-selected]").length).toBe(0);
  });

  it("sends a question with old/new coordinates for selected lines", () => {
    const onAskAboutSelection = vi.fn();
    const { container } = render(
      <GitDiffViewer
        diff={baseDiff}
        onClose={() => {}}
        onAskAboutSelection={onAskAboutSelection}
      />,
    );

    fireEvent.click(findLineRow(container, "old code here"));
    fireEvent.click(findLineRow(container, "new code here"));

    expect(screen.getByText("2 lines selected")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ask about selection" }),
    );

    expect(onAskAboutSelection).toHaveBeenCalledTimes(1);
    const question = onAskAboutSelection.mock.calls[0]?.[0] as string;
    expect(question).toContain("test.ts");
    expect(question).toContain("old line 2 / new line — (old side)");
    expect(question).toContain("- old code here");
    expect(question).toContain("old line — / new line 2 (new side)");
    expect(question).toContain("+ new code here");

    // Selection clears after asking.
    expect(screen.queryByText("2 lines selected")).not.toBeInTheDocument();
  });

  it("toggles a line off when clicked twice", () => {
    const { container } = render(
      <GitDiffViewer
        diff={baseDiff}
        onClose={() => {}}
        onAskAboutSelection={vi.fn()}
      />,
    );

    const addedLine = findLineRow(container, "new code here");
    fireEvent.click(addedLine);
    expect(screen.getByText("1 line selected")).toBeInTheDocument();

    fireEvent.click(addedLine);
    expect(screen.queryByText("1 line selected")).not.toBeInTheDocument();
  });
});
