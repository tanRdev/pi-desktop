// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SnapshotApi, SnapshotRestoreResult } from "@/features/snapshots";
import { AppHosts } from "./app-hosts";

const snapshotHostSpy = vi.fn();
const searchReplaceHostSpy = vi.fn();

vi.mock("@/components/ui/sonner", () => ({
  Toaster() {
    return <div data-testid="toaster" />;
  },
}));

vi.mock("@/features/command-palette", () => ({
  CommandPaletteHost() {
    return <div data-testid="command-palette-host" />;
  },
}));

vi.mock("@/features/settings", () => ({
  SettingsHost() {
    return <div data-testid="settings-host" />;
  },
}));

vi.mock("@/lib/keyboard", () => ({
  KeyboardHost() {
    return <div data-testid="keyboard-host" />;
  },
}));

vi.mock("@/features/notifications", () => ({
  NotificationHost() {
    return <div data-testid="notification-host" />;
  },
}));

vi.mock("@/lib/perf", () => ({
  PerfHost() {
    return <div data-testid="perf-host" />;
  },
}));

vi.mock("@/features/workspace/components/thread-search", () => ({
  ThreadSearchHost() {
    return <div data-testid="thread-search-host" />;
  },
}));

vi.mock("@/features/workspace/components/activity-panel", () => ({
  ActivityPanelHost() {
    return <div data-testid="activity-panel-host" />;
  },
}));

vi.mock("@/features/workspace/components/search-replace", () => ({
  SearchReplaceHost(props: {
    files: readonly { filePath: string; content: string }[];
  }) {
    searchReplaceHostSpy(props);
    return <div data-testid="search-replace-host">{props.files.length}</div>;
  },
}));

vi.mock("@/features/snapshots", () => ({
  SnapshotHost(props: { api: object }) {
    snapshotHostSpy(props);
    return <div data-testid="snapshot-host" />;
  },
}));

vi.mock("@/app-shortcuts", () => ({
  AppShortcuts() {
    return <div data-testid="app-shortcuts" />;
  },
}));

describe("AppHosts", () => {
  it("renders app hosts and forwards integration props", () => {
    const snapshotApi: SnapshotApi = {
      list: vi.fn(() => []),
      get: vi.fn(() => null),
      create: vi.fn(() => null),
      restore: vi.fn<(ts: number) => SnapshotRestoreResult>(() => ({
        kind: "not-found",
      })),
      delete: vi.fn(() => false),
      exportSnapshot: vi.fn(() => false),
    };
    const searchReplaceFiles = [
      { filePath: "src/app.tsx", content: "hello" },
      { filePath: "src/main.tsx", content: "world" },
    ] as const;

    render(
      <AppHosts
        snapshotApi={snapshotApi}
        searchReplaceFiles={searchReplaceFiles}
      />,
    );

    expect(screen.getByTestId("toaster")).toBeInTheDocument();
    expect(screen.getByTestId("command-palette-host")).toBeInTheDocument();
    expect(screen.getByTestId("thread-search-host")).toBeInTheDocument();
    expect(screen.getByTestId("settings-host")).toBeInTheDocument();
    expect(screen.getByTestId("keyboard-host")).toBeInTheDocument();
    expect(screen.getByTestId("notification-host")).toBeInTheDocument();
    expect(screen.getByTestId("perf-host")).toBeInTheDocument();
    expect(screen.getByTestId("app-shortcuts")).toBeInTheDocument();
    expect(screen.getByTestId("snapshot-host")).toBeInTheDocument();
    expect(screen.getByTestId("activity-panel-host")).toBeInTheDocument();
    expect(screen.getByTestId("search-replace-host")).toHaveTextContent("2");
    expect(snapshotHostSpy.mock.calls[0]?.[0]).toEqual({ api: snapshotApi });
    expect(searchReplaceHostSpy.mock.calls[0]?.[0]).toEqual({
      files: searchReplaceFiles,
    });
  });
});
