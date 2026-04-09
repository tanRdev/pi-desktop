import type {
  MentionSuggestion,
  SearchMatch,
  SlashSuggestion,
  WindowPosition,
} from "@pidesk/shared";
import { createStore } from "zustand/vanilla";

export type UiDialogId =
  | "settings"
  | "createWorktree"
  | "createThread"
  | "confirmRemoveRepository";

export interface UiHoverTarget {
  kind: "repository" | "worktree" | "project" | "thread" | "window";
  id: string;
}

export interface UiDialogsState {
  settings: boolean;
  createWorktree: boolean;
  createThread: boolean;
  confirmRemoveRepository: boolean;
}

export interface LauncherOverlayState {
  isOpen: boolean;
  query: string;
  results: SearchMatch[];
  selectedIndex: number;
  isLoading: boolean;
}

export interface FileTreeOverlayState {
  isOpen: boolean;
}

export interface UiOverlaysState {
  launcher: LauncherOverlayState;
  fileTree: FileTreeOverlayState;
}

function createClosedLauncherOverlayState(): LauncherOverlayState {
  return {
    isOpen: false,
    query: "",
    results: [],
    selectedIndex: -1,
    isLoading: false,
  };
}

export interface UiInteractionState {
  draggingWindowId: string | null;
  resizingWindowId: string | null;
  hoveredItem: UiHoverTarget | null;
  isMainWindowFullscreen: boolean;
  dialogs: UiDialogsState;
  overlays: UiOverlaysState;
  snapPreview: { windowId: string; position: WindowPosition } | null;
  promptAutocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  promptAutocompleteSelectedIndex: number;
  setDraggingWindowId(windowId: string | null): void;
  setResizingWindowId(windowId: string | null): void;
  setHoveredItem(item: UiHoverTarget | null): void;
  clearHoveredItem(): void;
  setMainWindowFullscreen(isFullscreen: boolean): void;
  setDialogOpen(dialog: UiDialogId, isOpen: boolean): void;
  openLauncherOverlay(): void;
  closeLauncherOverlay(): void;
  setLauncherQuery(query: string): void;
  setLauncherResults(results: SearchMatch[]): void;
  setLauncherSelectedIndex(index: number): void;
  setLauncherLoading(isLoading: boolean): void;
  openFileTreeOverlay(): void;
  closeFileTreeOverlay(): void;
  setSnapPreview(
    preview: { windowId: string; position: WindowPosition } | null,
  ): void;
  setPromptAutocomplete(
    suggestions: (SlashSuggestion | MentionSuggestion)[],
  ): void;
  setPromptAutocompleteSelectedIndex(index: number): void;
  clearPromptAutocomplete(): void;
  clearWorkspaceScopedState(): void;
}

export type UiInteractionStore = ReturnType<typeof createUiInteractionStore>;

export function createUiInteractionStore() {
  return createStore<UiInteractionState>()((set) => ({
    draggingWindowId: null,
    resizingWindowId: null,
    hoveredItem: null,
    isMainWindowFullscreen: false,
    dialogs: {
      settings: false,
      createWorktree: false,
      createThread: false,
      confirmRemoveRepository: false,
    },
    overlays: {
      launcher: createClosedLauncherOverlayState(),
      fileTree: {
        isOpen: false,
      },
    },
    snapPreview: null,
    promptAutocompleteSuggestions: [],
    promptAutocompleteSelectedIndex: -1,
    setDraggingWindowId(windowId) {
      set({ draggingWindowId: windowId });
    },
    setResizingWindowId(windowId) {
      set({ resizingWindowId: windowId });
    },
    setHoveredItem(item) {
      set({ hoveredItem: item });
    },
    clearHoveredItem() {
      set({ hoveredItem: null });
    },
    setMainWindowFullscreen(isMainWindowFullscreen) {
      set({ isMainWindowFullscreen });
    },
    setDialogOpen(dialog, isOpen) {
      set((state) => ({
        dialogs: {
          ...state.dialogs,
          [dialog]: isOpen,
        },
      }));
    },
    openLauncherOverlay() {
      set((state) => ({
        overlays: {
          launcher: {
            ...createClosedLauncherOverlayState(),
            isOpen: true,
          },
          fileTree: {
            ...state.overlays.fileTree,
            isOpen: false,
          },
        },
      }));
    },
    closeLauncherOverlay() {
      set((state) => ({
        overlays: {
          ...state.overlays,
          launcher: createClosedLauncherOverlayState(),
        },
      }));
    },
    setLauncherQuery(query) {
      set((state) => ({
        overlays: {
          ...state.overlays,
          launcher: {
            ...state.overlays.launcher,
            query,
          },
        },
      }));
    },
    setLauncherResults(results) {
      set((state) => ({
        overlays: {
          ...state.overlays,
          launcher: {
            ...state.overlays.launcher,
            results,
            selectedIndex: results.length > 0 ? 0 : -1,
          },
        },
      }));
    },
    setLauncherSelectedIndex(index) {
      set((state) => ({
        overlays: {
          ...state.overlays,
          launcher: {
            ...state.overlays.launcher,
            selectedIndex: index,
          },
        },
      }));
    },
    setLauncherLoading(isLoading) {
      set((state) => ({
        overlays: {
          ...state.overlays,
          launcher: {
            ...state.overlays.launcher,
            isLoading,
          },
        },
      }));
    },
    openFileTreeOverlay() {
      set((state) => ({
        overlays: {
          launcher: createClosedLauncherOverlayState(),
          fileTree: {
            ...state.overlays.fileTree,
            isOpen: true,
          },
        },
      }));
    },
    closeFileTreeOverlay() {
      set((state) => ({
        overlays: {
          ...state.overlays,
          fileTree: {
            ...state.overlays.fileTree,
            isOpen: false,
          },
        },
      }));
    },
    setSnapPreview(preview) {
      set({ snapPreview: preview });
    },
    setPromptAutocomplete(suggestions) {
      set({
        promptAutocompleteSuggestions: suggestions,
        promptAutocompleteSelectedIndex: suggestions.length > 0 ? 0 : -1,
      });
    },
    setPromptAutocompleteSelectedIndex(index) {
      set({ promptAutocompleteSelectedIndex: index });
    },
    clearPromptAutocomplete() {
      set({
        promptAutocompleteSuggestions: [],
        promptAutocompleteSelectedIndex: -1,
      });
    },
    clearWorkspaceScopedState() {
      set((state) => ({
        draggingWindowId: null,
        resizingWindowId: null,
        hoveredItem: null,
        isMainWindowFullscreen: state.isMainWindowFullscreen,
        overlays: {
          launcher: createClosedLauncherOverlayState(),
          fileTree: {
            isOpen: false,
          },
        },
        snapPreview: null,
        promptAutocompleteSuggestions: [],
        promptAutocompleteSelectedIndex: -1,
        dialogs: state.dialogs,
      }));
    },
  }));
}

export const uiInteractionStore = createUiInteractionStore();
