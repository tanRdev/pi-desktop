import { describe, expect, it, vi } from "vitest";

import { activateInitialWorkspaceSelection } from "./initial-workspace-activation";

describe("activateInitialWorkspaceSelection", () => {
  it("creates a bootstrap error host when there is no preferred workspace", async () => {
    const replacementHost = {
      id: "bootstrap-error-host",
    };
    const previousUnsubscribe = vi.fn();
    const session = {
      replaceHost: vi.fn(),
    };
    const subscribeToHost = vi.fn(() => vi.fn());
    const createBootstrapErrorHost = vi.fn(() => replacementHost);

    await activateInitialWorkspaceSelection({
      preferredWorkspacePath: null,
      fallbackWorkspacePath: null,
      shouldPreserveEmptySelection: false,
      session,
      activateWorkspacePath: vi.fn(),
      createBootstrapErrorHost,
      subscribeToHost,
    });

    expect(createBootstrapErrorHost).toHaveBeenCalledWith(
      "No workspace selected",
    );
    expect(session.replaceHost).toHaveBeenCalledTimes(1);
    const [host, options] = session.replaceHost.mock.calls[0] ?? [];
    expect(host).toBe(replacementHost);
    expect(options?.subscribe?.()).toBe(subscribeToHost.mock.results[0]?.value);
    expect(subscribeToHost).toHaveBeenCalledWith(replacementHost, null);
    expect(previousUnsubscribe).not.toHaveBeenCalled();
  });

  it("falls back to the remembered workspace when the preferred activation fails", async () => {
    const replacementHost = {
      id: "bootstrap-error-host",
    };
    const session = {
      replaceHost: vi.fn(),
    };
    const activateWorkspacePath = vi
      .fn<
        (
          targetPath: string,
          options?: { createIfMissing?: boolean },
        ) => Promise<void>
      >()
      .mockRejectedValueOnce(new Error("preferred failed"))
      .mockResolvedValueOnce(undefined);
    const subscribeToHost = vi.fn(() => vi.fn());
    const createBootstrapErrorHost = vi.fn(() => replacementHost);

    await activateInitialWorkspaceSelection({
      preferredWorkspacePath: "/repos/alpha/worktrees/feature",
      fallbackWorkspacePath: "/repos/alpha",
      shouldPreserveEmptySelection: true,
      session,
      activateWorkspacePath,
      createBootstrapErrorHost,
      subscribeToHost,
    });

    expect(activateWorkspacePath).toHaveBeenCalledTimes(2);
    expect(activateWorkspacePath).toHaveBeenNthCalledWith(
      1,
      "/repos/alpha/worktrees/feature",
      {
        createIfMissing: false,
      },
    );
    expect(activateWorkspacePath).toHaveBeenNthCalledWith(2, "/repos/alpha");
    expect(createBootstrapErrorHost).not.toHaveBeenCalled();
    expect(session.replaceHost).not.toHaveBeenCalled();
    expect(subscribeToHost).not.toHaveBeenCalled();
  });

  it("replaces the host when both preferred and fallback activation fail", async () => {
    const replacementHost = {
      id: "bootstrap-error-host",
    };
    const replacementUnsubscribe = vi.fn();
    const session = {
      replaceHost: vi.fn(),
    };
    const activateWorkspacePath = vi
      .fn<
        (
          targetPath: string,
          options?: { createIfMissing?: boolean },
        ) => Promise<void>
      >()
      .mockRejectedValueOnce(new Error("preferred failed"))
      .mockRejectedValueOnce(new Error("fallback failed"));
    const subscribeToHost = vi.fn(() => replacementUnsubscribe);
    const createBootstrapErrorHost = vi.fn(() => replacementHost);

    await activateInitialWorkspaceSelection({
      preferredWorkspacePath: "/repos/alpha/worktrees/feature",
      fallbackWorkspacePath: "/repos/alpha",
      shouldPreserveEmptySelection: false,
      session,
      activateWorkspacePath,
      createBootstrapErrorHost,
      subscribeToHost,
    });

    expect(createBootstrapErrorHost).toHaveBeenCalledWith(
      "activateWorkspacePath fallback: fallback failed",
    );
    expect(session.replaceHost).toHaveBeenCalledTimes(1);
    const [host, options] = session.replaceHost.mock.calls[0] ?? [];
    expect(host).toBe(replacementHost);
    expect(options?.subscribe?.()).toBe(replacementUnsubscribe);
    expect(subscribeToHost).toHaveBeenCalledWith(replacementHost, null);
  });
});
