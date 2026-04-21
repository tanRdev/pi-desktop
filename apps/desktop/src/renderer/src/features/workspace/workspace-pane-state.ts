import type { WorkspaceWindow } from "@pi-desktop/shared";

export type ContextSurfaceKey = "activity" | string;

export type ContextWindow = Extract<
  WorkspaceWindow,
  { kind: "file" | "terminal" | "git" }
>;

export function getMainPaneState({
  contextWindows,
  selectedContextSurface,
}: {
  contextWindows: ContextWindow[];
  selectedContextSurface: ContextSurfaceKey | null;
}) {
  const fileWindows = contextWindows
    .filter((window) => window.kind === "file")
    .map((window) => window.id);

  if (selectedContextSurface === null) {
    return {
      fileWindows,
      selectedFileWindowId: null,
      sideSurfaceKey: null,
    };
  }

  if (selectedContextSurface === "activity") {
    return {
      fileWindows,
      selectedFileWindowId: null,
      sideSurfaceKey: "activity",
    };
  }

  const selectedWindow =
    contextWindows.find((window) => window.id === selectedContextSurface) ??
    null;

  if (selectedWindow === null) {
    return {
      fileWindows,
      selectedFileWindowId: null,
      sideSurfaceKey: null,
    };
  }

  if (selectedWindow.kind === "file") {
    return {
      fileWindows,
      selectedFileWindowId: selectedWindow.id,
      sideSurfaceKey: null,
    };
  }

  return {
    fileWindows,
    selectedFileWindowId: null,
    sideSurfaceKey: selectedWindow.id,
  };
}
