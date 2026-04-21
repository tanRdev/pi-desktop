// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type UsePromptDockInputOptions,
  usePromptDockInput,
} from "./use-prompt-dock-input";

const originalCreateObjectURL = window.URL.createObjectURL;
const originalRevokeObjectURL = window.URL.revokeObjectURL;

function createOptions(
  overrides: Partial<UsePromptDockInputOptions> = {},
): UsePromptDockInputOptions {
  return {
    activeThreadId: "thread-1",
    draft: "",
    isPromptExecuting: false,
    autocompleteVisible: false,
    onDraftChange: vi.fn(),
    onSend: vi.fn(),
    onCancelPrompt: vi.fn(),
    onPromptKeyDown: vi.fn(),
    ...overrides,
  };
}

function renderInputHarness(options: UsePromptDockInputOptions) {
  function Harness(props: UsePromptDockInputOptions) {
    const controller = usePromptDockInput(props);

    return (
      <textarea
        data-testid="prompt-input"
        value={props.draft}
        onKeyDown={controller.handlePromptKeyDown}
        readOnly
      />
    );
  }

  return render(<Harness {...options} />);
}

beforeEach(() => {
  cleanup();
  window.localStorage.clear();

  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });

  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();

  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });

  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  });
});

describe("usePromptDockInput", () => {
  it("submits draft history and pasted images while idle", () => {
    const onSend = vi.fn();
    const onCancelPrompt = vi.fn();
    const pastedImages: File[][] = [];
    const listener = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail;
      if (!detail || typeof detail !== "object") return;
      if (!("files" in detail) || !Array.isArray(detail.files)) return;
      pastedImages.push(detail.files);
    };

    window.addEventListener("pi:paste-image", listener);

    const { result } = renderHook(() =>
      usePromptDockInput(
        createOptions({
          draft: "ship it",
          onSend,
          onCancelPrompt,
        }),
      ),
    );

    const image = new File(["binary"], "shot.png", { type: "image/png" });

    act(() => {
      result.current.handleImagePaste(image);
    });

    expect(result.current.pendingImages).toEqual([image]);

    act(() => {
      result.current.handleSubmit();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onCancelPrompt).not.toHaveBeenCalled();
    expect(result.current.pendingImages).toEqual([]);
    expect(pastedImages).toHaveLength(1);
    expect(pastedImages[0]?.[0]?.name).toBe("shot.png");
    expect(window.localStorage.getItem("pi:prompt-history:thread-1")).toBe(
      JSON.stringify(["ship it"]),
    );

    window.removeEventListener("pi:paste-image", listener);
  });

  it("cancels instead of sending when a prompt is already executing", () => {
    const onSend = vi.fn();
    const onCancelPrompt = vi.fn();

    const { result } = renderHook(() =>
      usePromptDockInput(
        createOptions({
          draft: "ship it",
          isPromptExecuting: true,
          onSend,
          onCancelPrompt,
        }),
      ),
    );

    result.current.handleSubmit();

    expect(onCancelPrompt).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem("pi:prompt-history:thread-1"),
    ).toBeNull();
  });

  it("submits on Cmd+Enter and cycles prompt history with arrow keys", () => {
    window.localStorage.setItem(
      "pi:prompt-history:thread-1",
      JSON.stringify(["first", "second"]),
    );

    const onDraftChange = vi.fn();
    const onSend = vi.fn();
    const onPromptKeyDown = vi.fn();

    renderInputHarness(
      createOptions({
        draft: "",
        onDraftChange,
        onSend,
        onPromptKeyDown,
      }),
    );

    const input = screen.getByTestId("prompt-input");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDraftChange).toHaveBeenLastCalledWith("second");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDraftChange).toHaveBeenLastCalledWith("first");

    fireEvent.keyDown(input, { key: "a" });

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onDraftChange).toHaveBeenLastCalledWith("second");

    fireEvent.keyDown(input, { key: "Enter", metaKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onPromptKeyDown).toHaveBeenCalled();
  });

  it("skips history navigation while autocomplete is visible", () => {
    window.localStorage.setItem(
      "pi:prompt-history:thread-1",
      JSON.stringify(["first", "second"]),
    );

    const onDraftChange = vi.fn();
    const onPromptKeyDown = vi.fn();

    renderInputHarness(
      createOptions({
        autocompleteVisible: true,
        onDraftChange,
        onPromptKeyDown,
      }),
    );

    fireEvent.keyDown(screen.getByTestId("prompt-input"), { key: "ArrowUp" });

    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onPromptKeyDown).toHaveBeenCalledTimes(1);
  });

  it("revokes object urls when removing images and on unmount", () => {
    const { result, unmount } = renderHook(() =>
      usePromptDockInput(createOptions()),
    );

    const firstImage = new File(["first"], "first.png", { type: "image/png" });
    const secondImage = new File(["second"], "second.png", {
      type: "image/png",
    });

    act(() => {
      result.current.handleImagePaste(firstImage);
      result.current.handleImagePaste(secondImage);
    });

    const firstUrl = result.current.getObjectUrl(firstImage);
    const secondUrl = result.current.getObjectUrl(secondImage);

    act(() => {
      result.current.handleRemovePendingImage(0);
    });

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(result.current.pendingImages).toEqual([secondImage]);

    unmount();

    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(secondUrl);
  });
});
