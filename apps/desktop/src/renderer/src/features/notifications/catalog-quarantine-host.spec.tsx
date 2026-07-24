import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../test/mock-pi-desktop";
import { CatalogQuarantineHost } from "./catalog-quarantine-host";

const toastWarning = vi.fn();

vi.mock("@/lib/toast", () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarning(...args),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("CatalogQuarantineHost", () => {
  afterEach(() => {
    uninstallMockPiDesktop();
    toastWarning.mockClear();
  });

  it("toasts glossary-friendly labels for drained quarantine notices", async () => {
    installMockPiDesktop({
      state: {
        getCatalogQuarantineNotices: async () => [
          { catalogLabel: "App preferences" },
          { catalogLabel: "Workspace session" },
        ],
      },
    });

    render(<CatalogQuarantineHost />);

    await vi.waitFor(() => {
      expect(toastWarning).toHaveBeenCalledTimes(2);
    });

    expect(toastWarning).toHaveBeenCalledWith(
      "App preferences recovered from corrupt data",
      expect.objectContaining({
        description: expect.stringMatching(/quarantined/i),
      }),
    );
    expect(toastWarning).toHaveBeenCalledWith(
      "Workspace session recovered from corrupt data",
      expect.objectContaining({
        description: expect.stringMatching(/Defaults were restored/i),
      }),
    );

    const serialized = JSON.stringify(toastWarning.mock.calls);
    expect(serialized).not.toMatch(/\.json|corrupt-|\/Users\//);
  });

  it("does nothing when there are no notices", async () => {
    installMockPiDesktop({
      state: {
        getCatalogQuarantineNotices: async () => [],
      },
    });

    render(<CatalogQuarantineHost />);

    await vi.waitFor(() => {
      expect(
        window.piDesktop.state.getCatalogQuarantineNotices,
      ).toHaveBeenCalled();
    });
    expect(toastWarning).not.toHaveBeenCalled();
  });
});
