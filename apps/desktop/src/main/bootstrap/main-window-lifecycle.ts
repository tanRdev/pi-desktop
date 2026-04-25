import type { BrowserWindow } from "electron";

type CreateAndTrackMainWindowInput = {
  createWindow(): Promise<BrowserWindow>;
  setMainWindow(window: BrowserWindow): void;
  subscribeToFullscreenChanges(window: BrowserWindow): () => void;
  setStoredMainWindow(window: BrowserWindow | null): void;
};

export async function createAndTrackMainWindow(
  input: CreateAndTrackMainWindowInput,
): Promise<BrowserWindow> {
  const window = await input.createWindow();

  input.setMainWindow(window);
  input.setStoredMainWindow(window);

  const unsubscribeFullscreen = input.subscribeToFullscreenChanges(window);

  window.on("closed", () => {
    unsubscribeFullscreen();
    input.setStoredMainWindow(null);
  });

  return window;
}
