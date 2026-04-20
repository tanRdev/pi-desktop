// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStore } from "zustand";

import { CenterFileViewer } from "./center-file-viewer";

vi.mock("zustand", () => ({
  useStore: vi.fn(),
}));

const fileContentPropsSpy = vi.fn();
vi.mock("./workspace-file-content", () => ({
  WorkspaceFileContent(props: Record<string, unknown>) {
    fileContentPropsSpy(props);
    return <div data-testid="workspace-file-content" />;
  },
}));

vi.mock("../../hooks/use-window-store", () => ({
  getWorkspaceSessionStore: () => ({}),
}));
vi.mock("../../stores/workspace-session-selectors", () => ({
  selectFileWindowStateByWorktree: vi.fn(),
}));

const defaultProps = {
  activeWorktreeId: "wt-1",
  windowId: "win-1",
  filePath: "/foo.ts",
  isDirty: false,
  onContentChange: vi.fn(),
  onFileSave: vi.fn(),
} as const;

function renderViewer(
  overrides: Partial<Parameters<typeof CenterFileViewer>[0]> = {},
) {
  return render(<CenterFileViewer {...defaultProps} {...overrides} />);
}

describe("CenterFileViewer", () => {
  afterEach(() => {
    cleanup();
    fileContentPropsSpy.mockClear();
    vi.mocked(defaultProps.onContentChange).mockClear();
    vi.mocked(defaultProps.onFileSave).mockClear();
  });

  it("passes file content from store to WorkspaceFileContent", () => {
    const content = { type: "text", content: "hello", path: "/foo.ts" };
    vi.mocked(useStore).mockReturnValue({
      content,
      isLoading: false,
      error: null,
    });

    renderViewer();

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ content, isLoading: false, error: null }),
    );
  });

  it("passes null content when store returns undefined", () => {
    vi.mocked(useStore).mockReturnValue(undefined);

    renderViewer();

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ content: null, isLoading: false, error: null }),
    );
  });

  it("forwards isDirty and isReadOnly props", () => {
    vi.mocked(useStore).mockReturnValue(undefined);

    renderViewer({ isDirty: true, isReadOnly: true });

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isDirty: true, isReadOnly: true }),
    );
  });

  it("wraps onContentChange to include windowId", () => {
    vi.mocked(useStore).mockReturnValue({
      content: null,
      isLoading: false,
      error: null,
    });
    const onContentChange = vi.fn();

    renderViewer({ onContentChange });

    const passedProps = fileContentPropsSpy.mock.calls[0]?.[0];
    (passedProps?.onContentChange as (c: string) => void)("new content");

    expect(onContentChange).toHaveBeenCalledWith("win-1", "new content");
  });

  it("wraps onFileSave to include windowId and filePath", () => {
    vi.mocked(useStore).mockReturnValue({
      content: null,
      isLoading: false,
      error: null,
    });
    const onFileSave = vi.fn();

    renderViewer({ onFileSave });

    const passedProps = fileContentPropsSpy.mock.calls[0]?.[0];
    (passedProps?.onSave as () => void)();

    expect(onFileSave).toHaveBeenCalledWith("win-1", "/foo.ts");
  });

  it("always passes className='h-full'", () => {
    vi.mocked(useStore).mockReturnValue(undefined);

    renderViewer();

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ className: "h-full" }),
    );
  });

  it("passes isLoading from store state", () => {
    vi.mocked(useStore).mockReturnValue({
      isLoading: true,
      content: null,
      error: null,
    });

    renderViewer();

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isLoading: true }),
    );
  });

  it("passes error from store state", () => {
    vi.mocked(useStore).mockReturnValue({
      error: "File not found",
      content: null,
      isLoading: false,
    });

    renderViewer();

    expect(fileContentPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: "File not found" }),
    );
  });
});
