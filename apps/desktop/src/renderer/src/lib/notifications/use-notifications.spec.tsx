// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNotificationCenter,
  type ToastSurface,
} from "./notification-center";
import { useNotifications } from "./use-notifications";

function createMockSurface(): ToastSurface {
  return {
    success: () => {},
    info: () => {},
    warning: () => {},
    error: () => {},
  };
}

describe("useNotifications", () => {
  afterEach(() => {
    cleanup();
  });

  it("reflects current state on mount", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    center.info("hello");

    const { result } = renderHook(() => useNotifications(center));
    expect(result.current.notifications).toHaveLength(1);
    const first = result.current.notifications[0];
    if (!first) throw new Error("expected one notification");
    expect(first.message).toBe("hello");
  });

  it("updates when push is called", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const { result } = renderHook(() => useNotifications(center));

    expect(result.current.notifications).toHaveLength(0);

    act(() => {
      result.current.success("yay");
    });

    expect(result.current.notifications).toHaveLength(1);
    const entry = result.current.notifications[0];
    if (!entry) throw new Error("expected one notification");
    expect(entry.level).toBe("success");
    expect(entry.message).toBe("yay");
  });

  it("exposes level helpers and generic push", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const { result } = renderHook(() => useNotifications(center));

    act(() => {
      result.current.push("error", "boom");
      result.current.warn("careful");
      result.current.info("fyi");
    });

    expect(result.current.notifications.map((n) => n.level)).toEqual([
      "info",
      "warn",
      "error",
    ]);
  });

  it("clear empties the list", () => {
    const center = createNotificationCenter({ toast: createMockSurface() });
    const { result } = renderHook(() => useNotifications(center));

    act(() => {
      result.current.success("a");
      result.current.success("b");
    });
    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clear();
    });
    expect(result.current.notifications).toHaveLength(0);
  });
});
