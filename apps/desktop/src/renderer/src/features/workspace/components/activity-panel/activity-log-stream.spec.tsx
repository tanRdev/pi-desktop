// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createActivityLogStream, useActivityLog } from "./activity-log-stream";

afterEach(() => {
  cleanup();
});

describe("createActivityLogStream", () => {
  it("starts with empty entries", () => {
    const stream = createActivityLogStream();
    expect(stream.entries).toHaveLength(0);
  });

  it("push adds entries", () => {
    const stream = createActivityLogStream();
    stream.push({ ts: 1, level: "info", scope: "test", message: "hello" });
    expect(stream.entries).toHaveLength(1);
    expect(stream.entries[0]?.message).toBe("hello");
  });

  it("respects maxEntries ring buffer", () => {
    const stream = createActivityLogStream({ maxEntries: 5 });
    for (let i = 0; i < 8; i++) {
      stream.push({ ts: i, level: "info", scope: "test", message: `msg-${i}` });
    }
    expect(stream.entries).toHaveLength(5);
    expect(stream.entries[0]?.message).toBe("msg-3");
    expect(stream.entries[4]?.message).toBe("msg-7");
  });

  it("clear empties entries", () => {
    const stream = createActivityLogStream();
    stream.push({ ts: 1, level: "info", scope: "test", message: "a" });
    stream.clear();
    expect(stream.entries).toHaveLength(0);
  });

  it("clear is no-op when already empty", () => {
    const stream = createActivityLogStream();
    expect(() => stream.clear()).not.toThrow();
  });

  it("subscribe receives current snapshot and updates", () => {
    const stream = createActivityLogStream();
    const received: Array<
      ReadonlyArray<import("@pi-desktop/shared").LogEntry>
    > = [];
    const unsubscribe = stream.subscribe((entries) => {
      received.push(entries);
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toHaveLength(0);

    stream.push({ ts: 1, level: "info", scope: "test", message: "hi" });
    expect(received).toHaveLength(2);
    expect(received[1]).toHaveLength(1);

    unsubscribe();
    stream.push({ ts: 2, level: "warn", scope: "test", message: "after" });
    expect(received).toHaveLength(2);
  });
});

describe("useActivityLog", () => {
  it("returns entries from stream", () => {
    const stream = createActivityLogStream();
    stream.push({ ts: 1, level: "info", scope: "test", message: "hello" });

    const { result } = renderHook(() => useActivityLog(stream));
    expect(result.current.entries).toHaveLength(1);
    const first = result.current.entries[0];
    if (!first) throw new Error("expected one entry");
    expect(first.message).toBe("hello");
  });

  it("updates when push is called", () => {
    const stream = createActivityLogStream();
    const { result } = renderHook(() => useActivityLog(stream));

    expect(result.current.entries).toHaveLength(0);

    act(() => {
      stream.push({ ts: 1, level: "warn", scope: "app", message: "careful" });
    });

    expect(result.current.entries).toHaveLength(1);
    const entry = result.current.entries[0];
    if (!entry) throw new Error("expected one entry");
    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("careful");
  });

  it("clear empties entries", () => {
    const stream = createActivityLogStream();
    stream.push({ ts: 1, level: "info", scope: "test", message: "a" });
    stream.push({ ts: 2, level: "error", scope: "test", message: "b" });

    const { result } = renderHook(() => useActivityLog(stream));
    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.clear();
    });
    expect(result.current.entries).toHaveLength(0);
  });

  it("unsubscribes on cleanup", () => {
    const stream = createActivityLogStream();
    const { result, unmount } = renderHook(() => useActivityLog(stream));
    expect(result.current.entries).toHaveLength(0);

    unmount();

    stream.push({ ts: 1, level: "info", scope: "test", message: "after" });
    expect(result.current.entries).toHaveLength(0);
  });
});
