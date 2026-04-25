// @vitest-environment jsdom
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  installMockPiDesktop,
  uninstallMockPiDesktop,
} from "../../../../../test/mock-pi-desktop";
import { renderWithProviders } from "../../../../../test/render-helpers";
import { FileTreePanel } from "./file-tree-panel";

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
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  uninstallMockPiDesktop();
  vi.restoreAllMocks();
});

describe("FileTreePanel", () => {
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

  it("renders 'No files' when workspacePath is null", () => {
    installMockPiDesktop({
      fs: {
        readDirectory: vi.fn(),
      },
    });

    renderWithProviders(
      <FileTreePanel workspacePath={null} onFileSelect={() => {}} />,
    );

    expect(screen.getByText("No files")).toBeInTheDocument();
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
