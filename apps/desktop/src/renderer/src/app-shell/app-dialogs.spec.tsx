// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppDialogs, type AppDialogsProps } from "./app-dialogs";

function createProps(
  overrides: Partial<AppDialogsProps> = {},
): AppDialogsProps {
  return {
    isCreateWorktreeOpen: false,
    setCreateWorktreeOpen: vi.fn(),
    newWorktreeBranch: "",
    setNewWorktreeBranch: vi.fn(),
    submitCreateWorktree: vi.fn(async () => undefined),
    worktreeCreateError: null,
    oauthDialogState: {
      open: false,
      mode: "providers",
      providers: [],
      requestedProviderId: null,
      isBusy: false,
    },
    setOAuthDialogOpen: vi.fn(),
    submitOAuthDialog: vi.fn(async () => undefined),
    isRemoveRepositoryOpen: false,
    setRemoveRepositoryOpen: vi.fn(),
    confirmRemoveRepositoryName: null,
    removeRepositoryError: null,
    submitRemoveRepository: vi.fn(async () => undefined),
    isInitGitRepoOpen: false,
    setInitGitRepoOpen: vi.fn(),
    initGitRepoName: null,
    submitInitGitRepo: vi.fn(async () => undefined),
    skipInitGitRepo: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("AppDialogs", () => {
  it("submits create worktree when Enter is pressed with a branch", () => {
    const props = createProps({
      isCreateWorktreeOpen: true,
      newWorktreeBranch: "feature/refactor-shell",
    });

    render(<AppDialogs {...props} />);

    fireEvent.keyDown(screen.getByTestId("worktree-branch-input"), {
      key: "Enter",
    });

    expect(props.submitCreateWorktree).toHaveBeenCalledTimes(1);
  });

  it("shows logout-specific row actions and disables disconnected providers", () => {
    const props = createProps({
      oauthDialogState: {
        open: true,
        mode: "logout",
        providers: [
          {
            id: "anthropic",
            name: "Anthropic (Claude Pro/Max)",
            usesCallbackServer: false,
            isAuthenticated: true,
          },
          {
            id: "github-copilot",
            name: "GitHub Copilot",
            usesCallbackServer: false,
            isAuthenticated: false,
          },
        ],
        requestedProviderId: null,
        isBusy: false,
      },
    });

    render(<AppDialogs {...props} />);

    expect(
      screen.getByRole("button", {
        name: /anthropic \(claude pro\/max\).*sign out/i,
      }),
    ).toBeEnabled();

    expect(
      screen.getByRole("button", {
        name: /github copilot.*not connected/i,
      }),
    ).toBeDisabled();
  });
});
