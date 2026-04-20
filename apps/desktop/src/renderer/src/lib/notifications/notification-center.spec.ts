import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationCenter,
  type ToastSurface,
} from "./notification-center";
import {
  resetNotificationPrefs,
  setNotificationPrefs,
} from "./notification-prefs";

vi.mock("./notification-sound", () => ({
  playNotificationSound: vi.fn(),
}));

function createMockSurface(): ToastSurface & {
  calls: Array<{ level: string; message: string; opts?: unknown }>;
} {
  const calls: Array<{ level: string; message: string; opts?: unknown }> = [];
  return {
    calls,
    success: (message, opts) => calls.push({ level: "success", message, opts }),
    info: (message, opts) => calls.push({ level: "info", message, opts }),
    warning: (message, opts) => calls.push({ level: "warning", message, opts }),
    error: (message, opts) => calls.push({ level: "error", message, opts }),
  };
}

describe("notification-center", () => {
  beforeEach(() => {
    setNotificationPrefs({
      levels: ["success", "info", "warn", "error"],
    });
  });

  afterEach(() => {
    resetNotificationPrefs();
  });

  it("records pushed notifications in newest-first order", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });

    center.success("First");
    center.error("Second");

    const list = center.list();
    expect(list).toHaveLength(2);
    const [first, second] = list;
    if (!first || !second) throw new Error("expected two entries");
    expect(first.message).toBe("Second");
    expect(first.level).toBe("error");
    expect(second.message).toBe("First");
  });

  it("forwards to the underlying toast surface using the right level", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });

    center.success("ok");
    center.info("hey");
    center.warn("careful");
    center.error("boom");

    expect(surface.calls.map((c) => c.level)).toEqual([
      "success",
      "info",
      "warning",
      "error",
    ]);
    expect(surface.calls.map((c) => c.message)).toEqual([
      "ok",
      "hey",
      "careful",
      "boom",
    ]);
  });

  it("forwards description and duration to the toast surface", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });

    center.success("Saved", { description: "All good", duration: 500 });

    expect(surface.calls).toHaveLength(1);
    const firstCall = surface.calls[0];
    if (!firstCall) throw new Error("expected one call");
    expect(firstCall.opts).toEqual({
      description: "All good",
      duration: 500,
    });
  });

  it("does not call toast when silent: true but still records", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });

    center.info("quiet", { silent: true });

    expect(surface.calls).toHaveLength(0);
    expect(center.list()).toHaveLength(1);
  });

  it("trims history past maxHistory", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface, maxHistory: 3 });

    center.info("a");
    center.info("b");
    center.info("c");
    center.info("d");

    const list = center.list();
    expect(list).toHaveLength(3);
    expect(list.map((n) => n.message)).toEqual(["d", "c", "b"]);
  });

  it("notifies subscribers on push and clear and unsubscribes", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });
    const sub = vi.fn();

    const unsub = center.subscribe(sub);
    expect(sub).toHaveBeenCalledTimes(1); // initial snapshot

    center.success("a");
    expect(sub).toHaveBeenCalledTimes(2);

    center.clear();
    expect(sub).toHaveBeenCalledTimes(3);
    const thirdCallArgs = sub.mock.calls[2];
    if (!thirdCallArgs) throw new Error("expected third call args");
    expect(thirdCallArgs[0]).toEqual([]);

    unsub();
    center.error("b");
    expect(sub).toHaveBeenCalledTimes(3);
  });

  it("uses provided id and timestamp generators", () => {
    const surface = createMockSurface();
    let i = 0;
    const center = createNotificationCenter({
      toast: surface,
      generateId: () => `id-${++i}`,
      now: () => 1000,
    });

    const n = center.warn("hi");
    expect(n.id).toBe("id-1");
    expect(n.createdAt).toBe(1000);
  });

  it("clear is a no-op when already empty (does not notify)", () => {
    const surface = createMockSurface();
    const center = createNotificationCenter({ toast: surface });
    const sub = vi.fn();
    center.subscribe(sub);
    sub.mockClear();
    center.clear();
    expect(sub).not.toHaveBeenCalled();
  });
});
