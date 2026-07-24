// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
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

  it("clears attachment chips when pi:prompt-sent fires", async () => {
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useAttachments("", onDraftChange));

    await act(async () => {
      await result.current.handlePickFiles();
    });

    await waitFor(() => {
      expect(result.current.uploadedFiles).toHaveLength(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent("pi:prompt-sent"));
    });

    expect(result.current.uploadedFiles).toHaveLength(0);
  });
});
