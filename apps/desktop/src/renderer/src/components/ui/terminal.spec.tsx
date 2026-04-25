// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal, type TerminalHandle } from "./terminal";

const terminalCreate = vi.fn();
const terminalWrite = vi.fn();
const terminalResize = vi.fn();
const terminalDestroy = vi.fn();
const terminalOnEvent = vi.fn();

type SelectionListener = () => void;

interface MockBufferLine {
  translateToString(trim?: boolean): string;
}

interface MockBuffer {
  length: number;
  getLine(row: number): MockBufferLine | undefined;
}

let lastMockTerminal: MockXTerm | null = null;
let lastMockFitAddon: MockFitAddon | null = null;

class MockXTerm {
  public cols = 80;
  public rows = 24;
  public readonly loadAddon = vi.fn<(addon: unknown) => void>();
  public readonly open = vi.fn<(element: HTMLElement) => void>();
  public readonly onData = vi.fn<(listener: (data: string) => void) => void>();
  public readonly write = vi.fn<(data: string) => void>();
  public readonly dispose = vi.fn<() => void>();
  public readonly clear = vi.fn<() => void>();
  public readonly focus = vi.fn<() => void>();

  public selectionListeners: SelectionListener[] = [];
  public currentSelection: string = "";

  public readonly onSelectionChange = vi.fn(
    (listener: SelectionListener): void => {
      this.selectionListeners.push(listener);
    },
  );
  public readonly hasSelection = vi.fn(() => this.currentSelection.length > 0);
  public readonly getSelection = vi.fn(() => this.currentSelection);

  public bufferLines: string[] = [];
  public readonly buffer = {
    active: {
      get length(): number {
        return lastMockTerminal?.bufferLines.length ?? 0;
      },
      getLine(row: number): MockBufferLine | undefined {
        const text = lastMockTerminal?.bufferLines[row];
        if (text === undefined) return undefined;
        return {
          translateToString: () => text,
        };
      },
    } satisfies MockBuffer,
  };

  constructor() {
    lastMockTerminal = this;
  }

  triggerSelection(text: string): void {
    this.currentSelection = text;
    for (const listener of this.selectionListeners) listener();
  }
}

class MockFitAddon {
  public readonly fit = vi.fn<() => void>();
  constructor() {
    lastMockFitAddon = this;
  }
}

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  public observe = vi.fn<(el: Element) => void>();
  public disconnect = vi.fn<() => void>();
  public unobserve = vi.fn<(el: Element) => void>();
  constructor(public readonly callback: ResizeCallback) {
    MockResizeObserver.instances.push(this);
  }
  trigger(): void {
    this.callback([]);
  }
}

vi.mock("@xterm/xterm", () => ({
  Terminal: MockXTerm,
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: MockFitAddon,
}));

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

vi.mock("boneyard-js/react", () => ({
  Skeleton({ children }: { children: unknown }) {
    return <>{children}</>;
  },
}));

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);

describe("Terminal", () => {
  beforeEach(() => {
    terminalCreate.mockReset();
    terminalCreate.mockResolvedValue({ status: "ready" });
    terminalWrite.mockReset();
    terminalWrite.mockResolvedValue(undefined);
    terminalResize.mockReset();
    terminalResize.mockResolvedValue(undefined);
    terminalDestroy.mockReset();
    terminalDestroy.mockResolvedValue(undefined);
    terminalOnEvent.mockReset();
    terminalOnEvent.mockReturnValue(() => undefined);

    lastMockTerminal = null;
    lastMockFitAddon = null;
    MockResizeObserver.instances = [];
    clipboardWriteText.mockClear();

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });

    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      value: {
        terminal: {
          create: terminalCreate,
          write: terminalWrite,
          resize: terminalResize,
          destroy: terminalDestroy,
          onEvent: terminalOnEvent,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("waits for cwd before creating the backend session", async () => {
    const view = render(<Terminal id="sidebar-terminal" cwd={undefined} />);

    await vi.dynamicImportSettled();

    expect(terminalCreate).not.toHaveBeenCalled();

    view.rerender(<Terminal id="sidebar-terminal" cwd="/tmp/workspace" />);

    await waitFor(() => {
      expect(terminalCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "sidebar-terminal",
          cwd: "/tmp/workspace",
        }),
      );
    });

    expect(terminalCreate).toHaveBeenCalledTimes(1);
  });

  it("debounces resize observer callbacks", async () => {
    render(
      <Terminal id="dbg-resize" cwd="/tmp/workspace" resizeDebounceMs={100} />,
    );

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockFitAddon).not.toBeNull());

    const initialFitCalls = lastMockFitAddon?.fit.mock.calls.length ?? 0;
    const observer = MockResizeObserver.instances.at(-1);
    expect(observer).toBeDefined();
    if (!observer) return;

    vi.useFakeTimers();
    try {
      // Fire multiple resize events in quick succession.
      observer.trigger();
      observer.trigger();
      observer.trigger();

      // Before debounce timeout: no additional fit calls beyond init.
      expect(lastMockFitAddon?.fit.mock.calls.length).toBe(initialFitCalls);
      expect(terminalResize).not.toHaveBeenCalled();

      // Advance slightly under threshold: still no resize.
      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(terminalResize).not.toHaveBeenCalled();

      // Cross threshold: exactly one resize fires despite 3 observer events.
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(terminalResize).toHaveBeenCalledTimes(1);
      expect(terminalResize).toHaveBeenCalledWith("dbg-resize", 80, 24);
    } finally {
      vi.useRealTimers();
    }
  });

  it("copies selected text to the clipboard when copyOnSelect is enabled", async () => {
    render(<Terminal id="copy-sel" cwd="/tmp/workspace" copyOnSelect={true} />);

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockTerminal).not.toBeNull());
    if (!lastMockTerminal) return;

    lastMockTerminal.triggerSelection("hello world");

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith("hello world");
    });
  });

  it("does not copy when copyOnSelect is disabled", async () => {
    render(
      <Terminal id="no-copy-sel" cwd="/tmp/workspace" copyOnSelect={false} />,
    );

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockTerminal).not.toBeNull());
    if (!lastMockTerminal) return;

    // Listener was never attached; manually attempt to trigger.
    expect(lastMockTerminal.onSelectionChange).not.toHaveBeenCalled();
    lastMockTerminal.triggerSelection("should-not-copy");

    await Promise.resolve();
    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it("skips clipboard write for empty selections", async () => {
    render(<Terminal id="empty-sel" cwd="/tmp/workspace" />);

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockTerminal).not.toBeNull());
    if (!lastMockTerminal) return;

    lastMockTerminal.currentSelection = "";
    lastMockTerminal.hasSelection.mockReturnValue(false);
    for (const listener of lastMockTerminal.selectionListeners) listener();

    await Promise.resolve();
    expect(clipboardWriteText).not.toHaveBeenCalled();
  });

  it("exposes imperative clear, focus, and findAll via ref", async () => {
    const handleRef = React.createRef<TerminalHandle>();
    render(<Terminal ref={handleRef} id="imperative" cwd="/tmp/workspace" />);

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockTerminal).not.toBeNull());
    if (!lastMockTerminal) return;

    lastMockTerminal.bufferLines = [
      "the quick brown fox",
      "jumps over the lazy dog",
      "another line with fox again",
    ];

    expect(handleRef.current).not.toBeNull();
    const found = handleRef.current?.findAll("fox");
    expect(found).toEqual({ count: 2, firstRow: 0 });

    const missing = handleRef.current?.findAll("zzz");
    expect(missing).toEqual({ count: 0, firstRow: -1 });

    handleRef.current?.clear();
    expect(lastMockTerminal.clear).toHaveBeenCalledTimes(1);

    handleRef.current?.focus();
    expect(lastMockTerminal.focus).toHaveBeenCalledTimes(1);
  });

  it("signals command completion after submitted input receives terminal data", async () => {
    const onCommandComplete = vi.fn();

    render(
      <Terminal
        id="command-complete"
        cwd="/tmp/workspace"
        onCommandComplete={onCommandComplete}
      />,
    );

    await vi.dynamicImportSettled();
    await waitFor(() => expect(lastMockTerminal).not.toBeNull());
    expect(terminalOnEvent).toHaveBeenCalledTimes(1);
    if (!lastMockTerminal) return;

    const sendInput = lastMockTerminal.onData.mock.calls[0]?.[0] as
      | ((data: string) => void)
      | undefined;
    const emitTerminalEvent = terminalOnEvent.mock.calls[0]?.[0] as
      | ((event: { type: string; id: string; data?: string }) => void)
      | undefined;

    expect(typeof sendInput).toBe("function");
    expect(typeof emitTerminalEvent).toBe("function");
    if (!sendInput || !emitTerminalEvent) return;

    vi.useFakeTimers();

    try {
      act(() => {
        sendInput("touch fresh.txt");
        emitTerminalEvent({
          type: "data",
          id: "command-complete",
          data: "$ ",
        });
      });
      expect(onCommandComplete).not.toHaveBeenCalled();

      act(() => {
        sendInput("\r");
        emitTerminalEvent({
          type: "data",
          id: "command-complete",
          data: "\r\n$ ",
        });
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(onCommandComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onCommandComplete).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
