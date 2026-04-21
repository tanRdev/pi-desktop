// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { useFocusRestoration } from "./use-focus-restoration";

function Host({ enabled = true }: { enabled?: boolean }) {
  useFocusRestoration(enabled);
  // Steal focus on mount.
  useEffect(() => {
    const btn = document.getElementById("inside");
    btn?.focus();
  }, []);
  return (
    <button type="button" id="inside">
      inside
    </button>
  );
}

function Harness({
  open,
  enabled = true,
}: {
  open: boolean;
  enabled?: boolean;
}) {
  return (
    <div>
      <button type="button" id="trigger">
        trigger
      </button>
      {open ? <Host enabled={enabled} /> : null}
    </div>
  );
}

describe("useFocusRestoration", () => {
  it("restores focus to the previously focused element on unmount", () => {
    const { rerender } = render(<Harness open={false} />);
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    act(() => trigger.focus());
    expect(document.activeElement).toBe(trigger);

    rerender(<Harness open={true} />);
    expect(document.activeElement?.id).toBe("inside");

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it("does nothing when disabled", () => {
    const { rerender } = render(<Harness open={false} enabled={false} />);
    const trigger = document.getElementById("trigger") as HTMLButtonElement;
    act(() => trigger.focus());
    rerender(<Harness open={true} enabled={false} />);
    rerender(<Harness open={false} enabled={false} />);
    // Focus is wherever it ended up — but should NOT be forcibly restored.
    // Since the inside button is gone, body is the active element.
    expect(document.activeElement).toBe(document.body);
  });
});
