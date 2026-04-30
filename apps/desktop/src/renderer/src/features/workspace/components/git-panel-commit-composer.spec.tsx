// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitPanelCommitComposer } from "./git-panel-commit-composer";

function renderComposer(
  overrides: Partial<React.ComponentProps<typeof GitPanelCommitComposer>> = {},
) {
  const props = {
    repositoryPath: "/tmp/pi-desktop",
    commitMessage: "ship it",
    isLoading: false,
    commitTemplates: undefined,
    canCommit: true,
    canCommitAndPush: true,
    canPull: true,
    canPush: true,
    canFetch: true,
    amend: false,
    canAmend: false,
    onCommitMessageChange: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndPush: vi.fn(),
    onPull: vi.fn(),
    onPush: vi.fn(),
    onFetch: vi.fn(),
    onAmendChange: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<GitPanelCommitComposer {...props} />),
    props,
  };
}

afterEach(() => {
  cleanup();
});

describe("GitPanelCommitComposer", () => {
  async function openCommitMenu(user: ReturnType<typeof userEvent.setup>) {
    const [button] = screen.getAllByRole("button", { name: /^Commit$/i });

    if (!button) {
      throw new Error("Expected a Commit button to open the menu");
    }

    await user.click(button);
  }

  function getOpenMenu() {
    const dialogs = screen.getAllByRole("dialog");
    const dialog = dialogs.at(-1);

    if (!dialog) {
      throw new Error("Expected an open dialog");
    }

    return dialog;
  }

  it("applies a selected commit template", async () => {
    const user = userEvent.setup();
    const onCommitMessageChange = vi.fn();

    renderComposer({ commitMessage: "", onCommitMessageChange });

    await user.click(
      screen.getByRole("button", { name: "Insert commit template" }),
    );
    await user.click(await screen.findByRole("button", { name: "feat" }));

    expect(onCommitMessageChange).toHaveBeenCalledWith("feat: ");
  });

  it("renders borders on the commit input and visible actions", () => {
    renderComposer();

    expect(screen.getByPlaceholderText("Commit message...")).toHaveClass(
      "border",
      "border-white/[0.06]",
    );
    expect(
      screen.getByRole("button", { name: "Insert commit template" }),
    ).toHaveClass("border", "border-white/[0.06]");
    expect(screen.getByRole("button", { name: /^Commit$/i })).toHaveClass(
      "border",
      "border-white/[0.06]",
    );
    expect(screen.getByRole("button", { name: /^Commit$/i })).not.toHaveClass(
      "border-none",
    );
  });

  it.each([
    ["Commit", "onCommit"],
    ["Commit & Push", "onCommitAndPush"],
    ["Push", "onPush"],
    ["Pull", "onPull"],
    ["Fetch", "onFetch"],
  ] as const)("invokes %s from the commit menu", async (label, handlerName) => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onCommitAndPush = vi.fn();
    const onPush = vi.fn();
    const onPull = vi.fn();
    const onFetch = vi.fn();

    renderComposer({ onCommit, onCommitAndPush, onPush, onPull, onFetch });

    await openCommitMenu(user);
    await user.click(
      within(getOpenMenu()).getByRole("button", { name: label }),
    );

    expect(
      {
        onCommit,
        onCommitAndPush,
        onPush,
        onPull,
        onFetch,
      }[handlerName],
    ).toHaveBeenCalledTimes(1);
  });

  it("shows amend controls only when the capability is enabled", async () => {
    const user = userEvent.setup();
    const onAmendChange = vi.fn();

    const { rerender } = renderComposer({ onAmendChange });

    expect(
      screen.queryByRole("checkbox", { name: "Amend previous commit" }),
    ).not.toBeInTheDocument();

    rerender(
      <GitPanelCommitComposer
        repositoryPath="/tmp/pi-desktop"
        commitMessage="ship it"
        isLoading={false}
        canCommit
        canCommitAndPush
        canPull
        canPush
        canFetch
        amend={false}
        canAmend
        onCommitMessageChange={vi.fn()}
        onCommit={vi.fn()}
        onCommitAndPush={vi.fn()}
        onPull={vi.fn()}
        onPush={vi.fn()}
        onFetch={vi.fn()}
        onAmendChange={onAmendChange}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Amend previous commit" }),
    );

    expect(onAmendChange).toHaveBeenCalledWith(true);
  });
});
