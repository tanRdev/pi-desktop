// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FileChangeSummary } from "./file-change-summary";

afterEach(() => {
  cleanup();
});

describe("FileChangeSummary", () => {
  it("reports unique files even when paths repeat", () => {
    render(
      <FileChangeSummary
        filePaths={["src/a.ts", "src/a.ts", "src/b.ts", "src/a.ts"]}
      />,
    );

    expect(screen.getByText("2 files changed")).toBeInTheDocument();
  });

  it("uses the singular label for one unique file", () => {
    render(<FileChangeSummary filePaths={["src/a.ts", "src/a.ts"]} />);

    expect(screen.getByText("1 file changed")).toBeInTheDocument();
  });

  it("expands to list each unique path once", () => {
    render(<FileChangeSummary filePaths={["src/a.ts", "src/a.ts"]} />);

    fireEvent.click(screen.getByRole("button", { name: /1 file changed/ }));

    expect(screen.getAllByText("src/a.ts")).toHaveLength(1);
  });

  it("renders a disabled zero summary when nothing changed", () => {
    render(<FileChangeSummary filePaths={[]} />);

    const button = screen.getByRole("button", { name: /0 files changed/ });
    expect(button).toBeDisabled();
  });
});
