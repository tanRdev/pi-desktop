import { describe, expect, it } from "vitest";
import { createUndoManager } from "./undo-manager";

describe("createUndoManager", () => {
  it("push adds to undo stack", () => {
    const mgr = createUndoManager<string>();
    mgr.push("a");
    expect(mgr.size()).toBe(1);
    expect(mgr.canUndo()).toBe(true);
  });

  it("undo returns last pushed state", () => {
    const mgr = createUndoManager<string>();
    mgr.push("a");
    mgr.push("b");
    expect(mgr.undo()).toBe("b");
    expect(mgr.size()).toBe(1);
  });

  it("redo returns the last undone state", () => {
    const mgr = createUndoManager<string>();
    mgr.push("a");
    mgr.undo();
    expect(mgr.canRedo()).toBe(true);
    expect(mgr.redo()).toBe("a");
  });

  it("canUndo is false when stack is empty", () => {
    const mgr = createUndoManager<string>();
    expect(mgr.canUndo()).toBe(false);
  });

  it("canRedo is false when redo stack is empty", () => {
    const mgr = createUndoManager<string>();
    expect(mgr.canRedo()).toBe(false);
  });

  it("push clears the redo stack", () => {
    const mgr = createUndoManager<string>();
    mgr.push("a");
    mgr.undo();
    expect(mgr.canRedo()).toBe(true);
    mgr.push("b");
    expect(mgr.canRedo()).toBe(false);
  });

  it("respects maxStackSize", () => {
    const mgr = createUndoManager<number>({ maxStackSize: 3 });
    mgr.push(1);
    mgr.push(2);
    mgr.push(3);
    mgr.push(4);
    expect(mgr.size()).toBe(3);
    expect(mgr.undo()).toBe(4);
    expect(mgr.undo()).toBe(3);
    expect(mgr.undo()).toBe(2);
  });

  it("clear empties both stacks", () => {
    const mgr = createUndoManager<string>();
    mgr.push("a");
    mgr.undo();
    expect(mgr.canUndo()).toBe(false);
    expect(mgr.canRedo()).toBe(true);
    mgr.clear();
    expect(mgr.canRedo()).toBe(false);
    expect(mgr.size()).toBe(0);
  });

  it("undo past empty returns undefined", () => {
    const mgr = createUndoManager<string>();
    expect(mgr.undo()).toBeUndefined();
    mgr.push("a");
    mgr.undo();
    expect(mgr.undo()).toBeUndefined();
  });

  it("redo past empty returns undefined", () => {
    const mgr = createUndoManager<string>();
    expect(mgr.redo()).toBeUndefined();
    mgr.push("a");
    mgr.undo();
    mgr.redo();
    expect(mgr.redo()).toBeUndefined();
  });
});
