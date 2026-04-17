import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./app";

const mockUseAppShellController = vi.fn();

vi.mock("./components/workspace/workspace-shell", () => ({
  WorkspaceShell() {
    return <div data-testid="workspace-shell">Workspace shell</div>;
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster() {
    return null;
  },
}));

vi.mock("./hooks/use-app-shell-controller", () => ({
  useAppShellController() {
    return mockUseAppShellController();
  },
}));

function createController(
  oauthDialogState: Partial<{
    open: boolean;
    mode: "providers" | "login" | "logout";
    providers: {
      id: string;
      name: string;
      usesCallbackServer?: boolean;
      isAuthenticated?: boolean;
    }[];
    requestedProviderId: string | null;
    isBusy: boolean;
  }> = {},
) {
  return {
    workspaceShellProps: {},
    isCreateWorktreeOpen: false,
    setCreateWorktreeOpen: vi.fn(),
    newWorktreeBranch: "",
    setNewWorktreeBranch: vi.fn(),
    submitCreateWorktree: vi.fn(async () => undefined),
    worktreeCreateError: null,
    oauthDialogState: {
      open: false,
      mode: "providers" as const,
      providers: [],
      requestedProviderId: null,
      isBusy: false,
      ...oauthDialogState,
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
  };
}

describe("App OAuth dialog", () => {
  it("shows logout-specific row actions and disables providers that are not connected", () => {
    mockUseAppShellController.mockReturnValue(
      createController({
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
      }),
    );

    render(<App />);

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
