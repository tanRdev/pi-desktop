import { describe, expect, it } from "vitest";
import { createUiInteractionStore } from "./ui-interaction-store";

describe("ui-interaction-store: dialog undo/redo", () => {
  it("records a history entry when a dialog is opened", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("packages", true);

    const state = store.getState();
    expect(state.dialogs.packages).toBe(true);
    expect(state.dialogUndoStack).toHaveLength(1);
    expect(state.dialogUndoStack[0]).toEqual({
      dialog: "packages",
      previous: false,
      next: true,
    });
    expect(state.dialogRedoStack).toHaveLength(0);
  });

  it("is a no-op when setting the same value", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("packages", false);

    const state = store.getState();
    expect(state.dialogs.packages).toBe(false);
    expect(state.dialogUndoStack).toHaveLength(0);
  });

  it("undoes the most recent dialog change", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("createWorktree", true);
    const didUndo = store.getState().undoDialogChange();

    expect(didUndo).toBe(true);
    const state = store.getState();
    expect(state.dialogs.createWorktree).toBe(false);
    expect(state.dialogUndoStack).toHaveLength(0);
    expect(state.dialogRedoStack).toHaveLength(1);
  });

  it("returns false when there is nothing to undo", () => {
    const store = createUiInteractionStore();
    expect(store.getState().undoDialogChange()).toBe(false);
  });

  it("redoes the last undone change", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("createThread", true);
    store.getState().undoDialogChange();
    const didRedo = store.getState().redoDialogChange();

    expect(didRedo).toBe(true);
    const state = store.getState();
    expect(state.dialogs.createThread).toBe(true);
    expect(state.dialogUndoStack).toHaveLength(1);
    expect(state.dialogRedoStack).toHaveLength(0);
  });

  it("returns false when there is nothing to redo", () => {
    const store = createUiInteractionStore();
    expect(store.getState().redoDialogChange()).toBe(false);
  });

  it("clears the redo stack when a new dialog change occurs", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("packages", true);
    store.getState().undoDialogChange();
    expect(store.getState().dialogRedoStack).toHaveLength(1);

    store.getState().setDialogOpen("createThread", true);
    expect(store.getState().dialogRedoStack).toHaveLength(0);
  });

  it("bounds the undo stack at 20 entries", () => {
    const store = createUiInteractionStore();
    for (let i = 0; i < 25; i += 1) {
      const isOpen = i % 2 === 0;
      store.getState().setDialogOpen("packages", isOpen);
    }
    const state = store.getState();
    expect(state.dialogUndoStack.length).toBeLessThanOrEqual(20);
    expect(state.dialogUndoStack).toHaveLength(20);
  });

  it("supports undo/redo across multiple dialogs", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("packages", true);
    store.getState().setDialogOpen("createWorktree", true);
    store.getState().setDialogOpen("createThread", true);

    expect(store.getState().undoDialogChange()).toBe(true);
    expect(store.getState().dialogs.createThread).toBe(false);
    expect(store.getState().dialogs.createWorktree).toBe(true);

    expect(store.getState().undoDialogChange()).toBe(true);
    expect(store.getState().dialogs.createWorktree).toBe(false);

    expect(store.getState().redoDialogChange()).toBe(true);
    expect(store.getState().dialogs.createWorktree).toBe(true);
  });
});

describe("ui-interaction-store: thread view tracking", () => {
  it("records a timestamp when a thread is marked viewed", () => {
    const store = createUiInteractionStore();
    const before = Date.now();
    store.getState().markThreadViewed("thread-1");
    const after = Date.now();

    const stamp = store.getState().threadLastViewedAt["thread-1"];
    expect(stamp).toBeDefined();
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });

  it("keeps separate timestamps per thread", () => {
    const store = createUiInteractionStore();
    store.getState().markThreadViewed("a");
    store.getState().markThreadViewed("b");
    const state = store.getState();
    expect(state.threadLastViewedAt).toHaveProperty("a");
    expect(state.threadLastViewedAt).toHaveProperty("b");
  });
});

describe("ui-interaction-store: overlay mutual exclusivity", () => {
  it("closes the file tree when opening the launcher", () => {
    const store = createUiInteractionStore();
    store.getState().openFileTreeOverlay();
    expect(store.getState().overlays.fileTree.isOpen).toBe(true);

    store.getState().openLauncherOverlay();
    const state = store.getState();
    expect(state.overlays.launcher.isOpen).toBe(true);
    expect(state.overlays.fileTree.isOpen).toBe(false);
  });

  it("closes the launcher when opening the file tree", () => {
    const store = createUiInteractionStore();
    store.getState().openLauncherOverlay();
    store.getState().setLauncherQuery("hello");
    expect(store.getState().overlays.launcher.isOpen).toBe(true);

    store.getState().openFileTreeOverlay();
    const state = store.getState();
    expect(state.overlays.fileTree.isOpen).toBe(true);
    expect(state.overlays.launcher.isOpen).toBe(false);
    expect(state.overlays.launcher.query).toBe("");
  });

  it("resets launcher fields on close", () => {
    const store = createUiInteractionStore();
    store.getState().openLauncherOverlay();
    store.getState().setLauncherQuery("search");
    store.getState().setLauncherSelectedIndex(3);
    store.getState().closeLauncherOverlay();

    const launcher = store.getState().overlays.launcher;
    expect(launcher.isOpen).toBe(false);
    expect(launcher.query).toBe("");
    expect(launcher.results).toEqual([]);
    expect(launcher.selectedIndex).toBe(-1);
  });
});

describe("ui-interaction-store: prompt autocomplete", () => {
  it("selects index 0 when suggestions are set", () => {
    const store = createUiInteractionStore();
    store
      .getState()
      .setPromptAutocomplete([
        { kind: "command", name: "help", slash: "/help" },
      ]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(0);
  });

  it("selects -1 when suggestions are empty", () => {
    const store = createUiInteractionStore();
    store.getState().setPromptAutocomplete([]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(-1);
  });

  it("clears autocomplete state", () => {
    const store = createUiInteractionStore();
    store
      .getState()
      .setPromptAutocomplete([
        { kind: "command", name: "help", slash: "/help" },
      ]);
    store.getState().clearPromptAutocomplete();
    const state = store.getState();
    expect(state.promptAutocompleteSuggestions).toEqual([]);
    expect(state.promptAutocompleteSelectedIndex).toBe(-1);
  });
});

describe("ui-interaction-store: clearWorkspaceScopedState", () => {
  it("preserves dialogs and fullscreen while clearing overlays and transient state", () => {
    const store = createUiInteractionStore();
    store.getState().setDialogOpen("packages", true);
    store.getState().setMainWindowFullscreen(true);
    store.getState().openLauncherOverlay();
    store.getState().setDraggingWindowId("w1");
    store.getState().setResizingWindowId("w2");
    store.getState().setHoveredItem({ kind: "window", id: "w1" });
    store.getState().setSnapPreview({
      windowId: "w1",
      position: { x: 0, y: 0, width: 100, height: 100 },
    });
    store
      .getState()
      .setPromptAutocomplete([
        { kind: "command", name: "help", slash: "/help" },
      ]);

    store.getState().clearWorkspaceScopedState();

    const state = store.getState();
    expect(state.dialogs.packages).toBe(true);
    expect(state.isMainWindowFullscreen).toBe(true);
    expect(state.overlays.launcher.isOpen).toBe(false);
    expect(state.overlays.fileTree.isOpen).toBe(false);
    expect(state.draggingWindowId).toBeNull();
    expect(state.resizingWindowId).toBeNull();
    expect(state.hoveredItem).toBeNull();
    expect(state.snapPreview).toBeNull();
    expect(state.promptAutocompleteSuggestions).toEqual([]);
    expect(state.promptAutocompleteSelectedIndex).toBe(-1);
  });
});
