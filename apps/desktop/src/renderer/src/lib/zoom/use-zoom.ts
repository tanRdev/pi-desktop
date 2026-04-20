import { useCallback, useSyncExternalStore } from "react";
import { zoomManager } from "./zoom-manager";

export function useZoom() {
  const zoom = useSyncExternalStore(
    useCallback((onStoreChange) => zoomManager.subscribe(onStoreChange), []),
    () => zoomManager.getZoom(),
  );

  const setZoom = useCallback((level: number) => {
    zoomManager.setZoom(level);
  }, []);

  const zoomIn = useCallback(() => {
    zoomManager.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    zoomManager.zoomOut();
  }, []);

  const resetZoom = useCallback(() => {
    zoomManager.resetZoom();
  }, []);

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom };
}
