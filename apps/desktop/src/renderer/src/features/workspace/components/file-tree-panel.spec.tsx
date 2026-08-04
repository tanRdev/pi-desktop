// @vitest-environment jsdom
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";

import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../../test/mock-pi-desktop";
import { renderWithProviders } from "../../../../../test/render-helpers";
import { FileTreePanel } from "./file-tree-panel";

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/components/ui/phosphor-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Stub = (props: Record<string, unknown>) =>
    React.createElement("span", props);
  return {
    ArrowClockwise: Stub,
    CaretRight: Stub,
    CircleNotch: Stub,
    File: Stub,
    FileCode: Stub,
    FileText: Stub,
    Folder: Stub,
    FolderOpen: Stub,
    FolderPlus: Stub,
    Image: Stub,
    MagnifyingGlass: Stub,
    Plus: Stub,
  };
});

// boneyard Skeleton renders children by default; bypass loading-fixture branch
// by ensuring data resolves synchronously in waitFor.

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  uninstallMockPiDesktop();
  vi.restoreAllMocks();
});

describe("FileTreePanel", () => {
  it("marks the tree busy during deferred initial and refresh loads", async () => {
    let resolveInitial!: (value: { path: string; entries: [] }) => void;
    let resolveRefresh!: (value: { path: string; entries: [] }) => void;
    const initial = new Promise<{ path: string; entries: [] }>((resolve) => {
      resolveInitial = resolve;
    });
    const refresh = new Promise<{ path: string; entries: [] }>((resolve) => {
      resolveRefresh = resolve;
    });
    const readDirectory = vi
      .fn()
      .mockReturnValueOnce(initial)
      .mockReturnValueOnce(refresh);
    installMockPiDesktop({ fs: { readDirectory } });
    const user = userEvent.setup();

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    const tree = screen.getByRole("tree");
    expect(tree).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolveInitial({ path: "/root", entries: [] });
    });
    expect(tree).toHaveAttribute("aria-busy", "false");

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(tree).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      resolveRefresh({ path: "/root", entries: [] });
    });
    expect(tree).toHaveAttribute("aria-busy", "false");
  });

  it("shows a safe error state instead of an empty tree when loading fails", async () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn(() =>
          Promise.reject(new Error("denied: /root/private")),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn’t load files",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("No files")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/root\/private/)).not.toBeInTheDocument();
  });

  it("retries a failed root load and renders the successful result", async () => {
    const user = userEvent.setup();
    const readDirectory = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        path: "/root",
        entries: [
          { name: "recovered.ts", path: "/root/recovered.ts", type: "file" },
        ],
      });
    installMockPiDesktop({ fs: { readDirectory } });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("recovered.ts")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("No files")).not.toBeInTheDocument();
    expect(readDirectory).toHaveBeenCalledTimes(2);
  });

  it("shows 'No files' when the root directory is empty", async () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({ path, entries: [] }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("No files")).toBeInTheDocument();
    });
  });

  it("renders file entries returned from the directory listing", async () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({
            path,
            entries: [
              { name: "readme.md", path: "/root/readme.md", type: "file" },
              { name: "src", path: "/root/src", type: "directory" },
            ],
          }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("readme.md")).toBeInTheDocument();
      expect(screen.getByText("src")).toBeInTheDocument();
    });
  });

  it("collapses a folder and shows a safe toast when expansion fails", async () => {
    const user = userEvent.setup();
    const readDirectory = vi.fn((path: string) => {
      if (path === "/root") {
        return Promise.resolve({
          path,
          entries: [{ name: "src", path: "/root/src", type: "directory" }],
        });
      }
      return Promise.reject(new Error("denied: /root/src"));
    });
    installMockPiDesktop({ fs: { readDirectory } });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    const folder = await screen.findByRole("treeitem", { name: "src" });
    await user.click(folder);

    await waitFor(() => {
      expect(folder).toHaveAttribute("aria-expanded", "false");
    });
    expect(toast.error).toHaveBeenCalledWith("Couldn’t load folder");
    expect(console.error).toHaveBeenCalledWith(
      "[file-tree] Failed to load directory: /root/src",
      expect.any(Error),
    );
  });

  it("refreshes the tree when the refresh button is clicked", async () => {
    const user = userEvent.setup();
    const readDirectory = vi.fn((path: string) =>
      Promise.resolve({ path, entries: [] }),
    );
    installMockPiDesktop({ fs: { readDirectory } });

    const { container } = renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );
    await waitFor(() => {
      expect(screen.getByText("No files")).toBeInTheDocument();
    });

    const refreshBtn = container.querySelector('button[aria-label="Refresh"]');
    expect(refreshBtn).toBeInstanceOf(HTMLButtonElement);
    if (!(refreshBtn instanceof HTMLButtonElement)) return;
    await user.click(refreshBtn);

    await waitFor(() => {
      const rootCalls = readDirectory.mock.calls.filter(([p]) => p === "/root");
      expect(rootCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders the Files header", () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({ path, entries: [] }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("renders the unavailable state without reading when workspacePath is null", () => {
    const readDirectory = vi.fn();
    installMockPiDesktop({
      fs: {
        readDirectory,
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath={null} onFileSelect={() => {}} />,
    );

    expect(
      screen.getByText("Select a Worktree to browse files"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No files")).not.toBeInTheDocument();
    expect(readDirectory).not.toHaveBeenCalled();
  });

  it("renders the filter input with accessible label", async () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({ path, entries: [] }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    expect(screen.getByLabelText("Filter files")).toBeInTheDocument();
  });

  it("filters file entries as the user types", async () => {
    const user = userEvent.setup();
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({
            path,
            entries: [
              { name: "alpha.ts", path: "/root/alpha.ts", type: "file" },
              { name: "beta.ts", path: "/root/beta.ts", type: "file" },
            ],
          }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByText("alpha.ts")).toBeInTheDocument();
      expect(screen.getByText("beta.ts")).toBeInTheDocument();
    });

    const input = screen.getByLabelText<HTMLInputElement>("Filter files");
    await user.type(input, "alp");

    await waitFor(() => {
      expect(screen.getByText("alpha.ts")).toBeInTheDocument();
      expect(screen.queryByText("beta.ts")).toBeNull();
    });
  });

  it("exposes a tree role with aria-label", async () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn((path: string) =>
          Promise.resolve({ path, entries: [] }),
        ),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath="/root" onFileSelect={() => {}} />,
    );

    expect(screen.getByRole("tree")).toHaveAttribute("aria-label", "File tree");
  });
});
