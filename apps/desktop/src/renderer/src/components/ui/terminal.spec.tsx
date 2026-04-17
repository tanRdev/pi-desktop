import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "./terminal";

const terminalCreate = vi.fn();
const terminalWrite = vi.fn();
const terminalResize = vi.fn();
const terminalDestroy = vi.fn();
const terminalOnEvent = vi.fn();

class MockXTerm {
  public cols = 80;
  public rows = 24;
  public readonly loadAddon = vi.fn<(addon: unknown) => void>();
  public readonly open = vi.fn<(element: HTMLElement) => void>();
  public readonly onData = vi.fn<(listener: (data: string) => void) => void>();
  public readonly write = vi.fn<(data: string) => void>();
  public readonly dispose = vi.fn<() => void>();
}

class MockFitAddon {
  public readonly fit = vi.fn<() => void>();
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

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

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
});
