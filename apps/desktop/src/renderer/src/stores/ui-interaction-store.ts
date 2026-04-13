import type {
  MentionSuggestion,
  SearchMatch,
  SlashSuggestion,
  WindowPosition,
} from "@pidesk/shared";
import { createStore } from "zustand/vanilla";

export type UiDialogId =
  | "packages"
  | "createWorktree"
  | "createThread"
  | "confirmRemoveRepository";

export interface UiHoverTarget {
  kind: "repository" | "worktree" | "project" | "thread" | "window";
  id: string;
}

export interface UiDialogsState {
  packages: boolean;
  createWorktree: boolean;
  createThread: boolean;
  confirmRemoveRepository: boolean;
}

export interface FileTreeOverlayState {
  isOpen: boolean;
}

export interface UiOverlaysState {
  fileTree: FileTreeOverlayState;
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
      packages: false,
      createWorktree: false,
      createThread: false,
      confirmRemoveRepository: false,
    },
    overlays: {
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
    openFileTreeOverlay() {
      set((state) => ({
        overlays: {
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
