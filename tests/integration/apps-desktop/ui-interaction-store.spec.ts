import { describe, expect, it } from "vitest";
import { createUiInteractionStore } from "../../../apps/desktop/src/renderer/src/stores/ui-interaction-store";

describe("ui-interaction-store", () => {
  it("switches between launcher and file-tree overlays and resets launcher search state", () => {
    const store = createUiInteractionStore();

    store.getState().openLauncherOverlay();
    store.getState().setLauncherQuery("workspace-shell");
    store.getState().setLauncherResults([
      {
        type: "file",
        path: "/tmp/repo/workspace-shell.tsx",
        name: "workspace-shell.tsx",
      },
    ]);
    store.getState().setLauncherSelectedIndex(0);
    store.getState().openFileTreeOverlay();

    expect(store.getState().overlays.fileTree.isOpen).toBe(true);
    expect(store.getState().overlays.launcher.isOpen).toBe(false);
    expect(store.getState().overlays.launcher.query).toBe("");
    expect(store.getState().overlays.launcher.results).toEqual([]);
    expect(store.getState().overlays.launcher.selectedIndex).toBe(-1);

    store.getState().closeLauncherOverlay();

    expect(store.getState().overlays.launcher.isOpen).toBe(false);
    expect(store.getState().overlays.launcher.query).toBe("");
    expect(store.getState().overlays.launcher.results).toEqual([]);
    expect(store.getState().overlays.launcher.selectedIndex).toBe(-1);
    expect(store.getState().overlays.fileTree.isOpen).toBe(true);
  });

  it("tracks transient snap, drag, resize, hover, dialog, and autocomplete state separately", () => {
    const store = createUiInteractionStore();

    store.getState().setDraggingWindowId("window-1");
    store.getState().setResizingWindowId("window-2");
    store.getState().setHoveredItem({ kind: "worktree", id: "worktree-1" });
    store.getState().setDialogOpen("settings", true);
    store.getState().setDialogOpen("createWorktree", true);
    store.getState().setSnapPreview({
      windowId: "window-1",
      position: { x: 10, y: 20, width: 300, height: 200 },
    });
    store.getState().setPromptAutocomplete([
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: "Deploy",
      },
    ]);
    store.getState().setPromptAutocompleteSelectedIndex(0);

    expect(store.getState().draggingWindowId).toBe("window-1");
    expect(store.getState().resizingWindowId).toBe("window-2");
    expect(store.getState().hoveredItem).toEqual({
      kind: "worktree",
      id: "worktree-1",
    });
    expect(store.getState().dialogs.settings).toBe(true);
    expect(store.getState().dialogs.createWorktree).toBe(true);
    expect(store.getState().snapPreview?.windowId).toBe("window-1");
    expect(store.getState().promptAutocompleteSuggestions).toHaveLength(1);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(0);

    store.getState().clearPromptAutocomplete();
    store.getState().setSnapPreview(null);
    store.getState().setDraggingWindowId(null);
    store.getState().setResizingWindowId(null);
    store.getState().clearHoveredItem();
    store.getState().setDialogOpen("settings", false);

    expect(store.getState().promptAutocompleteSuggestions).toEqual([]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(-1);
    expect(store.getState().snapPreview).toBeNull();
    expect(store.getState().draggingWindowId).toBeNull();
    expect(store.getState().resizingWindowId).toBeNull();
    expect(store.getState().hoveredItem).toBeNull();
    expect(store.getState().dialogs.settings).toBe(false);
    expect(store.getState().dialogs.createWorktree).toBe(true);
  });

  it("clears workspace-scoped transient state without closing dialogs", () => {
    const store = createUiInteractionStore();

    store.getState().setDraggingWindowId("window-1");
    store.getState().setResizingWindowId("window-2");
    store.getState().setHoveredItem({ kind: "worktree", id: "worktree-1" });
    store.getState().setDialogOpen("settings", true);
    store.getState().setDialogOpen("createWorktree", true);
    store.getState().setSnapPreview({
      windowId: "window-1",
      position: { x: 10, y: 20, width: 300, height: 200 },
    });
    store.getState().setPromptAutocomplete([
      {
        kind: "command",
        name: "deploy",
        slash: "/deploy",
        description: "Deploy",
      },
    ]);
    store.getState().openLauncherOverlay();
    store.getState().setLauncherQuery("notes");
    store.getState().openFileTreeOverlay();

    store.getState().clearWorkspaceScopedState();

    expect(store.getState().draggingWindowId).toBeNull();
    expect(store.getState().resizingWindowId).toBeNull();
    expect(store.getState().hoveredItem).toBeNull();
    expect(store.getState().snapPreview).toBeNull();
    expect(store.getState().promptAutocompleteSuggestions).toEqual([]);
    expect(store.getState().promptAutocompleteSelectedIndex).toBe(-1);
    expect(store.getState().overlays.launcher.isOpen).toBe(false);
    expect(store.getState().overlays.launcher.query).toBe("");
    expect(store.getState().overlays.fileTree.isOpen).toBe(false);
    expect(store.getState().dialogs.settings).toBe(true);
    expect(store.getState().dialogs.createWorktree).toBe(true);
  });

  it("tracks whether the main window is fullscreen for titlebar layout", () => {
    const store = createUiInteractionStore();

    store.getState().setMainWindowFullscreen(true);
    expect(store.getState().isMainWindowFullscreen).toBe(true);

    store.getState().setMainWindowFullscreen(false);
    expect(store.getState().isMainWindowFullscreen).toBe(false);
  });
});
