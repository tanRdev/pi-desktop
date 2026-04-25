// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitSplitButton } from "./git-split-button";

afterEach(() => {
  cleanup();
});

describe("GitSplitButton", () => {
  it("keeps visible focus styles on the main and menu buttons", async () => {
    const user = userEvent.setup();

    render(
      <GitSplitButton
        hasActiveThread
        hasChangesToCommit
        hasCommitsToPush
        isPromptExecuting={false}
        onAgentGitAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Commit & Push$/i }),
    ).toHaveClass("focus-visible:ring-1", "focus-visible:ring-white/20");
    expect(
      screen.getByRole("button", { name: "More git actions" }),
    ).toHaveClass("focus-visible:ring-1", "focus-visible:ring-white/20");

    await user.click(screen.getByRole("button", { name: "More git actions" }));

    expect(screen.getByRole("button", { name: /^Fetch$/i })).toHaveClass(
      "focus-visible:ring-1",
      "focus-visible:ring-white/20",
    );
  });

  it("uses the newly selected action for the main button", async () => {
    const user = userEvent.setup();
    const onAgentGitAction = vi.fn();

    render(
      <GitSplitButton
        hasActiveThread
        hasChangesToCommit
        hasCommitsToPush
        isPromptExecuting={false}
        onAgentGitAction={onAgentGitAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More git actions" }));
    await user.click(screen.getByRole("button", { name: /^Fetch$/i }));
    await user.click(screen.getByRole("button", { name: /^Fetch$/i }));

    expect(onAgentGitAction).toHaveBeenCalledWith("Fetch from origin");
  });
});
