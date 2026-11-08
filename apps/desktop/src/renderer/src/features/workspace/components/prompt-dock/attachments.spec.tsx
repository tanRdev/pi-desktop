// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAttachments } from "./attachments";

afterEach(() => {
  cleanup();
});

describe("useAttachments", () => {
  beforeEach(() => {
    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      value: {
        dialog: {
          showOpenDialog: vi.fn(async () => ["/tmp/note.md"]),
        },
      },
    });
  });

  it("derives previews from the retained thread draft, not a sent event", () => {
    const onDraftChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ draft }) => useAttachments(draft, onDraftChange),
      {
        initialProps: { draft: "Keep this @file:%2Ftmp%2Fnote.md " },
      },
    );
    expect(result.current.uploadedFiles).toHaveLength(1);
    act(() => window.dispatchEvent(new CustomEvent("pi:prompt-sent")));
    expect(result.current.uploadedFiles).toHaveLength(1);
    rerender({ draft: "" });
    expect(result.current.uploadedFiles).toHaveLength(0);
    rerender({ draft: "@file:%2Ftmp%2Fphoto.png " });
    expect(result.current.imageFiles[0]?.path).toBe("/tmp/photo.png");
  });

  it("preserves formatting and other mentions when removing a file", () => {
    const onDraftChange = vi.fn();
    const text = "Code:\n    run()\n@file:%2Ftmp%2Fa @file:%2Ftmp%2Fab";
    const { result } = renderHook(() => useAttachments(text, onDraftChange));
    act(() => result.current.handleRemoveFile("/tmp/a"));
    expect(onDraftChange).toHaveBeenCalledWith(
      "Code:\n    run()\n @file:%2Ftmp%2Fab",
    );
  });

  it("does not attach dialog results to a different thread", async () => {
    let resolvePaths = (_paths: string[]) => {};
    const pending = new Promise<string[]>((resolve) => {
      resolvePaths = resolve;
    });
    vi.mocked(window.piDesktop.dialog.showOpenDialog).mockReturnValueOnce(
      pending,
    );
    const onDraftChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ threadId }) => useAttachments("", onDraftChange, threadId),
      {
        initialProps: { threadId: "a" },
      },
    );
    let picking: Promise<void>;
    act(() => {
      picking = result.current.handlePickFiles();
    });
    rerender({ threadId: "b" });
    await act(async () => {
      resolvePaths(["/tmp/note.md"]);
      await picking;
    });
    expect(onDraftChange).not.toHaveBeenCalled();
  });
  it("removes equivalent raw and percent-encoded paths", () => {
    const onDraftChange = vi.fn();
    const { result } = renderHook(() =>
      useAttachments("@file:/tmp/a @file:%2ftmp%2fa", onDraftChange),
    );
    act(() => result.current.handleRemoveFile("/tmp/a"));
    expect(onDraftChange).toHaveBeenCalledWith(" ");
  });

  it("ignores file-dialog results after unmount", async () => {
    let resolvePaths = (_paths: string[]) => {};
    const pending = new Promise<string[]>((resolve) => {
      resolvePaths = resolve;
    });
    vi.mocked(window.piDesktop.dialog.showOpenDialog).mockReturnValueOnce(
      pending,
    );
    const onDraftChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAttachments("", onDraftChange, "a"),
    );
    const picking = result.current.handlePickFiles();
    unmount();
    await act(async () => {
      resolvePaths(["/tmp/note.md"]);
      await picking;
    });
    expect(onDraftChange).not.toHaveBeenCalled();
  });
});
