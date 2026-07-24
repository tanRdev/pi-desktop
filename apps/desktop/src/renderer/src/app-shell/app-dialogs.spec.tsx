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
    oauthPromptDialogState: {
      open: false,
      request: null,
      inputValue: "",
      isSubmitting: false,
    },
    setOAuthPromptDialogOpen: vi.fn(),
    setOAuthPromptInputValue: vi.fn(),
    submitOAuthPromptDialog: vi.fn(async () => undefined),
    cancelOAuthPromptDialog: vi.fn(async () => undefined),
    openOAuthPromptExternal: vi.fn(async () => undefined),
    copyOAuthPromptUserCode: vi.fn(async () => undefined),
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

  it("renders device-code OAuth prompt details and submit/cancel actions", () => {
    const props = createProps({
      oauthPromptDialogState: {
        open: true,
        request: {
          requestId: "req-1",
          providerId: "github",
          message: "Enter the code shown in your browser.",
          verificationUri: "https://example.com/verify",
          userCode: "ABCD-EFGH",
        },
        inputValue: "pasted",
        isSubmitting: false,
      },
    });

    render(<AppDialogs {...props} />);

    expect(screen.getByTestId("oauth-prompt-dialog")).toBeTruthy();
    expect(screen.getByText("Complete sign-in")).toBeTruthy();
    expect(screen.getByTestId("oauth-prompt-user-code").textContent).toBe(
      "ABCD-EFGH",
    );

    fireEvent.click(screen.getByTestId("oauth-prompt-submit"));
    expect(props.submitOAuthPromptDialog).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("oauth-prompt-cancel"));
    expect(props.cancelOAuthPromptDialog).toHaveBeenCalledTimes(1);
  });
});
