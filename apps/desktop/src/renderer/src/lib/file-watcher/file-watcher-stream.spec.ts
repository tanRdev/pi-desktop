// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FileChangeEvent, watch } from "./file-watcher-stream";

function createMockWatch() {
  let callback: ((event: FileChangeEvent) => void) | null = null;
  const watchFn = vi.fn(
    (_path: string, cb: (event: FileChangeEvent) => void) => {
      callback = cb;
      return () => {
        callback = null;
      };
    },
  );
  return {
    watchFn,
    emit: (event: FileChangeEvent) => {
      if (callback) callback(event);
    },
  };
}

describe("file-watcher-stream", () => {
  let mock: ReturnType<typeof createMockWatch>;
  let fakeNow: number;

  beforeEach(() => {
    fakeNow = 1000;
    mock = createMockWatch();
    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      writable: true,
      value: {
        fs: {
          watch: mock.watchFn,
        },
      },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls window.piDesktop.fs.watch with the workspace path", () => {
    const _stream = watch("/workspace/project", { now: () => fakeNow });
    expect(mock.watchFn).toHaveBeenCalledWith(
      "/workspace/project",
      expect.any(Function),
    );
  });

  it("subscribes and receives debounced events", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "modify",
      path: "/workspace/project/foo.ts",
      timestamp: 0,
    });
    mock.emit({
      type: "modify",
      path: "/workspace/project/foo.ts",
      timestamp: 0,
    });

    expect(subscriber).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const event = subscriber.mock.calls[0]?.[0];
    expect(event).toBeDefined();
    if (!event) throw new Error("expected event");
    expect(event.type).toBe("modify");
    expect(event.path).toBe("/workspace/project/foo.ts");
  });

  it("debounces same-file rapid changes into a single event", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "modify",
      path: "/workspace/project/a.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(50);
    mock.emit({
      type: "modify",
      path: "/workspace/project/a.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(50);
    mock.emit({
      type: "modify",
      path: "/workspace/project/a.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("emits separate events for different files", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "create",
      path: "/workspace/project/a.ts",
      timestamp: 0,
    });
    mock.emit({
      type: "create",
      path: "/workspace/project/b.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(2);
  });

  it("resolves create+delete sequence to create", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "create",
      path: "/workspace/project/x.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(20);
    mock.emit({
      type: "delete",
      path: "/workspace/project/x.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const event = subscriber.mock.calls[0]?.[0];
    if (!event) throw new Error("expected event");
    expect(event.type).toBe("create");
  });

  it("resolves delete+create sequence to modify", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "delete",
      path: "/workspace/project/y.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(20);
    mock.emit({
      type: "create",
      path: "/workspace/project/y.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const event = subscriber.mock.calls[0]?.[0];
    if (!event) throw new Error("expected event");
    expect(event.type).toBe("modify");
  });

  it("resolves create+modify sequence to create", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "create",
      path: "/workspace/project/z.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(20);
    mock.emit({
      type: "modify",
      path: "/workspace/project/z.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const event = subscriber.mock.calls[0]?.[0];
    if (!event) throw new Error("expected event");
    expect(event.type).toBe("create");
  });

  it("resolves modify+delete sequence to delete", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "modify",
      path: "/workspace/project/w.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(20);
    mock.emit({
      type: "delete",
      path: "/workspace/project/w.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(1);
    const event = subscriber.mock.calls[0]?.[0];
    if (!event) throw new Error("expected event");
    expect(event.type).toBe("delete");
  });

  it("unsubscribes and stops receiving events", () => {
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    const unsubscribe = stream.subscribe(subscriber);

    unsubscribe();

    mock.emit({
      type: "modify",
      path: "/workspace/project/gone.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    expect(subscriber).toHaveBeenCalledTimes(0);
  });

  it("reports active state correctly", () => {
    const stream = watch("/workspace/project", { now: () => fakeNow });
    expect(stream.isActive()).toBe(true);
    expect(stream.getActivePath()).toBe("/workspace/project");
  });

  it("does not throw when window.piDesktop.fs.watch is undefined", () => {
    Object.defineProperty(window, "piDesktop", {
      configurable: true,
      writable: true,
      value: { fs: {} },
    });

    const stream = watch("/workspace/project", { now: () => fakeNow });
    expect(stream.isActive()).toBe(true);

    const subscriber = vi.fn();
    stream.subscribe(subscriber);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("uses provided now for timestamps", () => {
    fakeNow = 9999;
    const stream = watch("/workspace/project", {
      now: () => fakeNow,
      debounceMs: 100,
    });
    const subscriber = vi.fn();
    stream.subscribe(subscriber);

    mock.emit({
      type: "modify",
      path: "/workspace/project/t.ts",
      timestamp: 0,
    });
    vi.advanceTimersByTime(100);

    const event = subscriber.mock.calls[0]?.[0];
    if (!event) throw new Error("expected event");
    expect(event.timestamp).toBe(9999);
  });
});
