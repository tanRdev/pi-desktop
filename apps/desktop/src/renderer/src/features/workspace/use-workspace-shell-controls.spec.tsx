// @vitest-environment jsdom
import type {
  AppPreferences,
  ProviderSnapshot,
  SettingsSnapshot,
} from "@pi-desktop/shared";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type UseWorkspaceShellControlsOptions,
  useWorkspaceShellControls,
} from "./use-workspace-shell-controls";

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const providerSnapshots: ProviderSnapshot[] = [
  {
    id: "google",
    name: "Google",
    isConfigured: true,
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        providerId: "google",
        contextWindow: 1_048_576,
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    isConfigured: true,
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        providerId: "anthropic",
        contextWindow: 200_000,
      },
    ],
  },
];

const settingsSnapshot: SettingsSnapshot = {
  currentProviderId: "google",
  currentModelId: "gemini-2.5-pro",
  defaultProvider: "google",
  defaultModel: "gemini-2.5-pro",
};

function renderModelSelectionHarness(
  onChange: React.ChangeEventHandler<HTMLSelectElement>,
) {
  return render(
    <select data-testid="model-selection" onChange={onChange}>
      <option value="">Choose a model</option>
      <option value="google::gemini-2.5-pro">Gemini 2.5 Pro</option>
      <option value="anthropic::claude-sonnet-4-20250514">
        Claude Sonnet 4
      </option>
    </select>,
  );
}

function createOptions(
  overrides: Partial<UseWorkspaceShellControlsOptions> = {},
) {
  const reload = vi.fn(async () => undefined);
  const switchModel = vi.fn(async () => undefined);
  const updateAppPreferences = vi.fn(async () => undefined);
  const openOAuthDialog = vi.fn(async () => undefined);

  return {
    agentStatus: "ready",
    runtimeMode: "build",
    providerSnapshots,
    settingsSnapshot,
    appPreferences: {} satisfies AppPreferences,
    reload,
    switchModel,
    updateAppPreferences,
    openOAuthDialog,
    ...overrides,
  };
}

describe("useWorkspaceShellControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("derives current shell control state from snapshots and preferences", () => {
    const { result } = renderHook(() =>
      useWorkspaceShellControls(
        createOptions({
          agentStatus: "streaming",
          runtimeMode: "plan",
          appPreferences: {
            leftSidebarWidth: 320,
            favoriteModels: ["anthropic::claude-sonnet-4-20250514"],
          },
        }),
      ),
    );

    expect(result.current.displayAgentStatus).toBe("streaming");
    expect(result.current.runtimeModeLabel).toBe("plan mode");
    expect(result.current.currentModelValue).toBe("google::gemini-2.5-pro");
    expect(result.current.leftSidebarWidth).toBe(320);
    expect(result.current.favoriteModels).toEqual([
      "anthropic::claude-sonnet-4-20250514",
    ]);
  });

  it("switches models from the select bridge and ignores invalid values", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useWorkspaceShellControls(options));

    renderModelSelectionHarness((event) => {
      void result.current.handleModelSelection(event);
    });

    fireEvent.change(screen.getByTestId("model-selection"), {
      target: { value: "anthropic::claude-sonnet-4-20250514" },
    });

    await waitFor(() => {
      expect(options.switchModel).toHaveBeenCalledWith({
        providerId: "anthropic",
        modelId: "claude-sonnet-4-20250514",
      });
    });

    fireEvent.change(screen.getByTestId("model-selection"), {
      target: { value: "" },
    });

    expect(options.switchModel).toHaveBeenCalledTimes(1);
  });

  it("toasts when model switching fails", async () => {
    const { toast } = await import("@/lib/toast");
    const options = createOptions({
      switchModel: vi.fn(async () => {
        throw new Error("Provider offline");
      }),
    });
    const { result } = renderHook(() => useWorkspaceShellControls(options));

    renderModelSelectionHarness((event) => {
      void result.current.handleModelSelection(event);
    });

    fireEvent.change(screen.getByTestId("model-selection"), {
      target: { value: "anthropic::claude-sonnet-4-20250514" },
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to switch model", {
        description: "Provider offline",
      });
    });
  });

  it("updates favorites and sidebar width through app preferences", async () => {
    const options = createOptions({
      appPreferences: {
        favoriteModels: ["google::gemini-2.5-pro"],
      },
    });
    const { result } = renderHook(() => useWorkspaceShellControls(options));

    act(() => {
      result.current.handleToggleFavorite(
        "anthropic::claude-sonnet-4-20250514",
      );
      result.current.handleToggleFavorite("google::gemini-2.5-pro");
      result.current.handleLeftSidebarResize(288);
    });

    expect(options.updateAppPreferences).toHaveBeenNthCalledWith(1, {
      favoriteModels: [
        "google::gemini-2.5-pro",
        "anthropic::claude-sonnet-4-20250514",
      ],
    });
    expect(options.updateAppPreferences).toHaveBeenNthCalledWith(2, {
      favoriteModels: [],
    });
    expect(options.updateAppPreferences).toHaveBeenNthCalledWith(3, {
      leftSidebarWidth: 288,
    });
  });

  it("reloads model menu data on open and delegates provider connection", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useWorkspaceShellControls(options));

    act(() => {
      result.current.handleModelMenuOpenChange(false);
      result.current.handleModelMenuOpenChange(true);
      result.current.handleConnectProvider();
    });

    await waitFor(() => {
      expect(options.reload).toHaveBeenCalledTimes(1);
    });
    expect(options.openOAuthDialog).toHaveBeenCalledWith("providers", null);
  });
});
