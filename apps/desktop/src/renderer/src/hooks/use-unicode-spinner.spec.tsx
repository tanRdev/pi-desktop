// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnicodeSpinner } from "./use-unicode-spinner";

const testSpinner = {
  frames: ["A", "B", "C", "D"],
  interval: 100,
};

function SpinnerProbe({
  active,
  onFrame,
}: {
  active: boolean;
  onFrame: (frame: string) => void;
}) {
  const frame = useUnicodeSpinner(testSpinner, active);
  React.useEffect(() => {
    onFrame(frame);
  }, [frame, onFrame]);
  return <span data-testid="frame">{frame}</span>;
}

describe("useUnicodeSpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns the first frame when inactive", () => {
    const seen: string[] = [];
    render(<SpinnerProbe active={false} onFrame={(f) => seen.push(f)} />);
    expect(seen[0]).toBe("A");
  });

  it("advances frames while active and shares one interval across consumers", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const { container } = render(
      <>
        <SpinnerProbe active={true} onFrame={() => {}} />
        <SpinnerProbe active={true} onFrame={() => {}} />
        <SpinnerProbe active={true} onFrame={() => {}} />
      </>,
    );

    // Only one shared interval regardless of consumer count.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    const frames = () =>
      Array.from(container.querySelectorAll("[data-testid=frame]")).map(
        (n) => n.textContent,
      );

    const initial = frames();
    expect(initial[0]).toBe("A");

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const next = frames();
    // All three consumers observe the same new frame.
    expect(next[0]).not.toBe(initial[0]);
    expect(next[1]).toBe(next[0]);
    expect(next[2]).toBe(next[0]);
  });

  it("stops the interval when the last subscriber unmounts", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(
      <SpinnerProbe active={true} onFrame={() => {}} />,
    );

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
