import { describe, expect, it } from "vitest";

import { createWindowStoreHarness } from "./window-store-harness";

type HarnessWindow = {
  id: string;
  kind: "file";
  title: string;
  filePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isFocused: boolean;
  state: "normal";
  isDirty: boolean;
};

type HarnessState = {
  layout: {
    windows: HarnessWindow[];
    nextZIndex: number;
    focusedWindowId: string | null;
    snapGridSize: number;
    zoom: number;
    panX: number;
    panY: number;
  };
  snapPreview: null;
};

type HarnessAction =
  | {
      type: "CREATE_WINDOW";
      payload: {
        window: HarnessWindow;
      };
    }
  | { type: "CLEAR_ALL" };

describe("window-store-harness", () => {
  it("creates windows through injected dependencies while notifying subscribers", () => {
    const reducerCalls: string[] = [];
    const createCalls: number[] = [];

    const store = createWindowStoreHarness<
      HarnessState,
      HarnessAction,
      HarnessWindow,
      never,
      never
    >({
      createInitialState: (): HarnessState => ({
        layout: {
          windows: [],
          nextZIndex: 1,
          focusedWindowId: null,
          snapGridSize: 24,
          zoom: 0.9,
          panX: 0,
          panY: 0,
        },
        snapPreview: null,
      }),
      reduce: (state, action) => {
        reducerCalls.push(action.type);
        if (action.type !== "CREATE_WINDOW") {
          return {
            layout: {
              windows: [],
              nextZIndex: 1,
              focusedWindowId: null,
              snapGridSize: 24,
              zoom: 0.9,
              panX: 0,
              panY: 0,
            },
            snapPreview: null,
          };
        }

        return {
          ...state,
          layout: {
            ...state.layout,
            windows: [...state.layout.windows, action.payload.window],
            nextZIndex: state.layout.nextZIndex + 1,
            focusedWindowId: action.payload.window.id,
          },
        };
      },
      actions: {
        createWindow: (window) => ({
          type: "CREATE_WINDOW",
          payload: { window },
        }),
        closeWindow: () => ({ type: "CLEAR_ALL" }),
        focusWindow: () => ({ type: "CLEAR_ALL" }),
        moveWindow: () => ({ type: "CLEAR_ALL" }),
        resizeWindow: () => ({ type: "CLEAR_ALL" }),
        updateWindow: () => ({ type: "CLEAR_ALL" }),
        setDirty: () => ({ type: "CLEAR_ALL" }),
        setZoom: () => ({ type: "CLEAR_ALL" }),
        zoomIn: () => ({ type: "CLEAR_ALL" }),
        zoomOut: () => ({ type: "CLEAR_ALL" }),
        resetZoom: () => ({ type: "CLEAR_ALL" }),
        setPan: () => ({ type: "CLEAR_ALL" }),
        reorderWindows: () => ({ type: "CLEAR_ALL" }),
        setSnapPreview: () => ({ type: "CLEAR_ALL" }),
        clearAll: () => ({ type: "CLEAR_ALL" }),
      },
      createWindowFromAction: (_action, windows, nextZIndex, cwd, options) => {
        createCalls.push(windows.length);

        return {
          id: `file-${nextZIndex}`,
          kind: "file",
          title: cwd ?? "created",
          filePath: options?.width
            ? `/tmp/${options.width}.ts`
            : "/tmp/created.ts",
          x: 10,
          y: 20,
          width: options?.width ?? 640,
          height: options?.height ?? 420,
          zIndex: nextZIndex,
          isFocused: true,
          state: "normal",
          isDirty: false,
        };
      },
    });

    const snapshots = [store.getState().layout.windows.length];
    const unsubscribe = store.subscribe((state) => {
      snapshots.push(state.layout.windows.length);
    });

    const window = store.createWindow(
      { kind: "file", filePath: "/tmp/input.ts" },
      "/tmp/worktree",
      { width: 800, height: 500 },
    );

    unsubscribe();
    store.clearAll();

    expect(createCalls).toEqual([0]);
    expect(reducerCalls).toEqual(["CREATE_WINDOW", "CLEAR_ALL"]);
    expect(window.id).toBe("file-1");
    expect(store.getState().layout.windows).toHaveLength(0);
    expect(snapshots).toEqual([0, 1]);
  });
});
