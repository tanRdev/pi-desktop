const STORAGE_KEY = "pi-desktop:zoom-level";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const DECIMAL_PLACES = 2;

function clampZoom(value: number): number {
  const rounded =
    Math.round(value * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rounded));
}

function readFromStorage(): number {
  if (typeof localStorage === "undefined") return 1;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return 1;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampZoom(parsed) : 1;
  } catch {
    return 1;
  }
}

function writeToStorage(level: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function applyToDom(level: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.zoom = String(level);
}

export interface ZoomManager {
  getZoom(): number;
  setZoom(level: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  subscribe(listener: (zoom: number) => void): () => void;
}

export function createZoomManager(): ZoomManager {
  const listeners = new Set<(zoom: number) => void>();
  let current = readFromStorage();

  function notify(): void {
    for (const listener of listeners) {
      listener(current);
    }
  }

  function setZoom(level: number): void {
    const next = clampZoom(level);
    if (next === current) return;
    current = next;
    writeToStorage(current);
    applyToDom(current);
    notify();
  }

  applyToDom(current);

  return {
    getZoom(): number {
      return current;
    },

    setZoom,

    zoomIn(): void {
      setZoom(current + ZOOM_STEP);
    },

    zoomOut(): void {
      setZoom(current - ZOOM_STEP);
    },

    resetZoom(): void {
      setZoom(1);
    },

    subscribe(listener: (zoom: number) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const zoomManager = createZoomManager();
