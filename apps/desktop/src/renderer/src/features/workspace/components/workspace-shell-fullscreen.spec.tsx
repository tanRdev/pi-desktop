// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiInteractionStore } from "@/stores/ui-interaction-store";
import { useWorkspaceShellFullscreen } from "./workspace-shell-fullscreen";

describe("useWorkspaceShellFullscreen", () => {
  let onFullscreenChanged: ((isFullscreen: boolean) => void) | null = null;
  let unsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unsubscribe = vi.fn();
    uiInteractionStore.getState().setMainWindowFullscreen(false);

    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      writable: true,
      value: {
        window: {
          getFullscreenState: vi.fn(async () => true),
          onFullscreenChanged: vi.fn(
            (listener: (isFullscreen: boolean) => void) => {
              onFullscreenChanged = listener;
              return unsubscribe;
            },
          ),
        },
      },
    });
  });

  afterEach(() => {
    onFullscreenChanged = null;
    uiInteractionStore.getState().setMainWindowFullscreen(false);
  });

  it("syncs the initial fullscreen state and live updates into the UI store", async () => {
    renderHook(() => useWorkspaceShellFullscreen());

    await waitFor(() => {
      expect(uiInteractionStore.getState().isMainWindowFullscreen).toBe(true);
    });

    onFullscreenChanged?.(false);

    expect(uiInteractionStore.getState().isMainWindowFullscreen).toBe(false);
  });

  it("unsubscribes from fullscreen updates on unmount", () => {
    const { unmount } = renderHook(() => useWorkspaceShellFullscreen());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
