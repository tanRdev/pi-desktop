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
import { toast } from "@/lib/toast";

vi.mock("@/lib/toast", () => ({
  toast: {
    info: vi.fn(),
  },
}));

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("usePromptDockInput", () => {
  it("submits draft history while idle", () => {
    const onSend = vi.fn();
    const onCancelPrompt = vi.fn();

    const { result } = renderHook(() =>
      usePromptDockInput(
        createOptions({
          draft: "ship it",
          onSend,
          onCancelPrompt,
        }),
      ),
    );

    act(() => {
      result.current.handleSubmit();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onCancelPrompt).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("pi:prompt-history:thread-1")).toBe(
      JSON.stringify(["ship it"]),
    );
  });

  it("shows a truthful toast when an image is pasted", () => {
    const { result } = renderHook(() =>
      usePromptDockInput(
        createOptions({
          activeThreadId: "thread-9",
        }),
      ),
    );

    act(() => {
      result.current.handleImagePaste(
        new File(["binary"], "shot.png", { type: "image/png" }),
      );
    });

    expect(toast.info).toHaveBeenCalledWith("Paste image isn't supported yet", {
      description: "Use Attach files to add images to your prompt.",
    });
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
});
