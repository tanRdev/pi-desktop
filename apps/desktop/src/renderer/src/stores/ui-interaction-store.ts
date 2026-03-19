import type {
  MentionSuggestion,
  SlashSuggestion,
  WindowPosition,
} from "@pidesk/shared";
import { createStore } from "zustand/vanilla";

export type UiDialogId = "settings" | "createWorktree";

export interface UiHoverTarget {
  kind: "repository" | "worktree" | "project" | "thread" | "window";
  id: string;
}

export interface UiDialogsState {
  settings: boolean;
  createWorktree: boolean;
}

export interface UiInteractionState {
  draggingWindowId: string | null;
  resizingWindowId: string | null;
  hoveredItem: UiHoverTarget | null;
  dialogs: UiDialogsState;
  snapPreview: { windowId: string; position: WindowPosition } | null;
  promptAutocompleteSuggestions: (SlashSuggestion | MentionSuggestion)[];
  promptAutocompleteSelectedIndex: number;
  setDraggingWindowId(windowId: string | null): void;
  setResizingWindowId(windowId: string | null): void;
  setHoveredItem(item: UiHoverTarget | null): void;
  clearHoveredItem(): void;
  setDialogOpen(dialog: UiDialogId, isOpen: boolean): void;
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
    dialogs: {
      settings: false,
      createWorktree: false,
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
    setDialogOpen(dialog, isOpen) {
      set((state) => ({
        dialogs: {
          ...state.dialogs,
          [dialog]: isOpen,
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
        snapPreview: null,
        promptAutocompleteSuggestions: [],
        promptAutocompleteSelectedIndex: -1,
        dialogs: state.dialogs,
      }));
    },
  }));
}

export const uiInteractionStore = createUiInteractionStore();
