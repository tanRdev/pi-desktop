import type { CreateWindowAction } from "@pi-desktop/shared";

import type { WindowCreationOptions } from "./window-store-create";

type WindowStoreHarnessState<ManagedWindow> = {
  layout: {
    windows: ManagedWindow[];
    nextZIndex: number;
  };
};

type WindowStoreHarnessActions<Action, ManagedWindow, Updates, Preview> = {
  createWindow: (window: ManagedWindow) => Action;
  closeWindow: (windowId: string) => Action;
  focusWindow: (windowId: string) => Action;
  moveWindow: (windowId: string, x: number, y: number) => Action;
  resizeWindow: (windowId: string, width: number, height: number) => Action;
  updateWindow: (windowId: string, updates: Updates) => Action;
  setDirty: (windowId: string, isDirty: boolean) => Action;
  setZoom: (zoom: number) => Action;
  zoomIn: () => Action;
  zoomOut: () => Action;
  resetZoom: () => Action;
  setPan: (panX: number, panY: number) => Action;
  reorderWindows: (fromIndex: number, toIndex: number) => Action;
  setSnapPreview: (preview: Preview | null) => Action;
  clearAll: () => Action;
};

type CreateWindowStoreHarnessInput<
  State extends WindowStoreHarnessState<ManagedWindow>,
  Action,
  ManagedWindow,
  Updates,
  Preview,
> = {
  createInitialState: () => State;
  reduce: (state: State, action: Action) => State;
  createWindowFromAction: (
    action: CreateWindowAction,
    existingWindows: ManagedWindow[],
    nextZIndex: number,
    cwd?: string,
    options?: WindowCreationOptions,
  ) => ManagedWindow;
  actions: WindowStoreHarnessActions<Action, ManagedWindow, Updates, Preview>;
};

export function createWindowStoreHarness<
  State extends WindowStoreHarnessState<ManagedWindow>,
  Action,
  ManagedWindow,
  Updates,
  Preview,
>(
  input: CreateWindowStoreHarnessInput<
    State,
    Action,
    ManagedWindow,
    Updates,
    Preview
  >,
) {
  let state = input.createInitialState();
  const listeners = new Set<(state: State) => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function dispatch(action: Action): void {
    state = input.reduce(state, action);
    notify();
  }

  return {
    getState(): State {
      return state;
    },

    subscribe(listener: (state: State) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch,

    createWindow(
      action: CreateWindowAction,
      cwd?: string,
      options?: WindowCreationOptions,
    ): ManagedWindow {
      const window = input.createWindowFromAction(
        action,
        state.layout.windows,
        state.layout.nextZIndex,
        cwd,
        options,
      );
      dispatch(input.actions.createWindow(window));
      return window;
    },

    closeWindow(windowId: string): void {
      dispatch(input.actions.closeWindow(windowId));
    },

    focusWindow(windowId: string): void {
      dispatch(input.actions.focusWindow(windowId));
    },

    moveWindow(windowId: string, x: number, y: number): void {
      dispatch(input.actions.moveWindow(windowId, x, y));
    },

    resizeWindow(windowId: string, width: number, height: number): void {
      dispatch(input.actions.resizeWindow(windowId, width, height));
    },

    updateWindow(windowId: string, updates: Updates): void {
      dispatch(input.actions.updateWindow(windowId, updates));
    },

    setDirty(windowId: string, isDirty: boolean): void {
      dispatch(input.actions.setDirty(windowId, isDirty));
    },

    setZoom(zoom: number): void {
      dispatch(input.actions.setZoom(zoom));
    },

    zoomIn(): void {
      dispatch(input.actions.zoomIn());
    },

    zoomOut(): void {
      dispatch(input.actions.zoomOut());
    },

    resetZoom(): void {
      dispatch(input.actions.resetZoom());
    },

    setPan(panX: number, panY: number): void {
      dispatch(input.actions.setPan(panX, panY));
    },

    reorderWindows(fromIndex: number, toIndex: number): void {
      dispatch(input.actions.reorderWindows(fromIndex, toIndex));
    },

    setSnapPreview(preview: Preview | null): void {
      dispatch(input.actions.setSnapPreview(preview));
    },

    clearAll(): void {
      dispatch(input.actions.clearAll());
    },
  };
}
