// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContextWindow } from "@/features/workspace/workspace-pane-state";
import { TitleBarTabs } from "./title-bar-tabs";

type FileContextWindow = Extract<ContextWindow, { kind: "file" }>;

const makeFileWindow = (
  overrides: Partial<FileContextWindow> & {
    id?: string;
    filePath?: string;
  } = {},
): FileContextWindow => ({
  id: overrides.id ?? "file-1",
  kind: "file",
  title: "App.tsx",
  filePath: overrides.filePath ?? "/src/App.tsx",
  isDirty: false,
  isFocused: false,
  state: "normal",
  encoding: "utf-8",
  isReadOnly: false,
  x: 0,
  y: 0,
  width: 600,
  height: 400,
  zIndex: 1,
  ...overrides,
});

afterEach(() => {
  cleanup();
});

describe("TitleBarTabs", () => {
  it("closes a file tab without selecting it first", async () => {
    const user = userEvent.setup();
    const onSelectContextSurface = vi.fn();
    const onCloseFileWindow = vi.fn();

    render(
      <TitleBarTabs
        activeThreadId="thread-1"
        activeThreadTitle="Chat"
        contextWindows={[makeFileWindow()]}
        selectedContextSurface={null}
        onSelectContextSurface={onSelectContextSurface}
        onCloseFileWindow={onCloseFileWindow}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Close App.tsx" }));

    expect(onCloseFileWindow).toHaveBeenCalledWith("file-1");
    expect(onSelectContextSurface).not.toHaveBeenCalled();
  });
});
