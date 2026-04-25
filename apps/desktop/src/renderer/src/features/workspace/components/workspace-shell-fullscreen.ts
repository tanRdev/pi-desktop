import * as React from "react";
import { uiInteractionStore } from "@/stores/ui-interaction-store";

export function useWorkspaceShellFullscreen() {
  React.useEffect(() => {
    let disposed = false;
    const interactions = uiInteractionStore.getState();

    void window.piDesktop.window.getFullscreenState().then((isFullscreen) => {
      if (!disposed) {
        interactions.setMainWindowFullscreen(isFullscreen);
      }
    });

    const unsubscribe = window.piDesktop.window.onFullscreenChanged(
      (isFullscreen) => {
        uiInteractionStore.getState().setMainWindowFullscreen(isFullscreen);
      },
    );

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);
}
