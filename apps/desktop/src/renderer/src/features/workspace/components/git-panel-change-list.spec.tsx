// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CombinedChangeList } from "./git-panel-change-list";
import type { FileStageEntry, GitPanelCapabilities } from "./git-panel-model";

const NO_CAPABILITIES: GitPanelCapabilities = {
  amend: false,
  revertFile: false,
  listBranches: false,
  switchBranch: false,
  listStashes: false,
};

function renderChangeList(
  overrides: Partial<React.ComponentProps<typeof CombinedChangeList>> = {},
) {
  const props: React.ComponentProps<typeof CombinedChangeList> = {
    entries: [
      { path: "src/already-staged.ts", state: "staged", status: "modified" },
      { path: "src/needs-stage.ts", state: "unstaged", status: "modified" },
      { path: "src/new-file.ts", state: "untracked", status: "untracked" },
      { path: "src/old-file.ts", state: "unstaged", status: "deleted" },
    ] satisfies ReadonlyArray<FileStageEntry>,
    focusedPath: "src/needs-stage.ts",
    capabilities: NO_CAPABILITIES,
    onStage: vi.fn(),
    onStageAll: vi.fn(),
    onUnstage: vi.fn(),
    onUnstageAll: vi.fn(),
    onDiscard: vi.fn(),
    onRevert: vi.fn(),
    onSelectFile: vi.fn(),
    onCopyPath: vi.fn(),
    onFocusRow: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<CombinedChangeList {...props} />),
    props,
  };
}

afterEach(() => {
  cleanup();
});

describe("CombinedChangeList", () => {
  it("summarizes counts and bulk stage state from staged and unstaged entries", async () => {
    const user = userEvent.setup();
    const onStageAll = vi.fn();
    const onUnstageAll = vi.fn();

    renderChangeList({ onStageAll, onUnstageAll });

    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("~2")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    await user.click(screen.getByRole("button", { name: "Deselect all" }));

    expect(onStageAll).toHaveBeenCalledWith([
      "src/needs-stage.ts",
      "src/new-file.ts",
      "src/old-file.ts",
    ]);
    expect(onUnstageAll).toHaveBeenCalledWith(["src/already-staged.ts"]);
  });

  it("renders file rows and forwards row actions", async () => {
    const user = userEvent.setup();
    const onStage = vi.fn();
    const onUnstage = vi.fn();
    const onSelectFile = vi.fn();
    const onCopyPath = vi.fn();
    const onFocusRow = vi.fn();

    renderChangeList({
      onStage,
      onUnstage,
      onSelectFile,
      onCopyPath,
      onFocusRow,
    });

    await user.click(
      screen.getByRole("button", { name: "Stage src/needs-stage.ts" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Unstage src/already-staged.ts" }),
    );
    await user.click(
      screen.getByRole("button", { name: "src/needs-stage.ts" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Copy path src/needs-stage.ts" }),
    );

    expect(onStage).toHaveBeenCalledWith("src/needs-stage.ts");
    expect(onUnstage).toHaveBeenCalledWith("src/already-staged.ts");
    expect(onFocusRow).toHaveBeenCalledWith("src/needs-stage.ts");
    expect(onSelectFile).toHaveBeenCalledWith("src/needs-stage.ts", false);
    expect(onCopyPath).toHaveBeenCalledWith("src/needs-stage.ts");
  });
});
