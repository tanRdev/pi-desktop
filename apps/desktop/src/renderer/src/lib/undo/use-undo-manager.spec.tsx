// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createUndoManager } from "./undo-manager";
import { useUndoManager } from "./use-undo-manager";

describe("useUndoManager", () => {
  it("returns canUndo false initially", () => {
    const mgr = createUndoManager<string>();
    const { result } = renderHook(() => useUndoManager(mgr));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("reflects canUndo after push", () => {
    const mgr = createUndoManager<string>();
    const { result } = renderHook(() => useUndoManager(mgr));
    act(() => {
      mgr.push("a");
    });
    expect(result.current.canUndo).toBe(true);
  });

  it("reflects canRedo after undo", () => {
    const mgr = createUndoManager<string>();
    const { result } = renderHook(() => useUndoManager(mgr));
    act(() => {
      mgr.push("a");
    });
    act(() => {
      result.current.undo();
    });
    expect(result.current.canRedo).toBe(true);
    expect(result.current.canUndo).toBe(false);
  });

  it("redo restores canUndo", () => {
    const mgr = createUndoManager<string>();
    const { result } = renderHook(() => useUndoManager(mgr));
    act(() => {
      mgr.push("a");
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });
});
