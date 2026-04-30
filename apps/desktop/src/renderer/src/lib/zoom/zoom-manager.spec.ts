// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZoomManager } from "./zoom-manager";

const STORAGE_KEY = "pi-desktop:zoom-level";

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    key(index) {
      const keys = Array.from(data.keys());
      return keys[index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.style.zoom = "";
  vi.unstubAllGlobals();
});

describe("createZoomManager", () => {
  it("returns default zoom of 1 when nothing is stored", () => {
    const mgr = createZoomManager();
    expect(mgr.getZoom()).toBe(1);
  });

  it("reads persisted zoom from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "1.5");
    const mgr = createZoomManager();
    expect(mgr.getZoom()).toBe(1.5);
  });

  it("setZoom clamps to minimum 0.5", () => {
    const mgr = createZoomManager();
    mgr.setZoom(0.1);
    expect(mgr.getZoom()).toBe(0.5);
  });

  it("setZoom clamps to maximum 3", () => {
    const mgr = createZoomManager();
    mgr.setZoom(5);
    expect(mgr.getZoom()).toBe(3);
  });

  it("zoomIn increases zoom by 0.1 step", () => {
    const mgr = createZoomManager();
    mgr.zoomIn();
    expect(mgr.getZoom()).toBeCloseTo(1.1, 5);
  });

  it("zoomOut decreases zoom by 0.1 step", () => {
    const mgr = createZoomManager();
    mgr.setZoom(1.2);
    mgr.zoomOut();
    expect(mgr.getZoom()).toBeCloseTo(1.1, 5);
  });

  it("resetZoom sets zoom back to 1", () => {
    const mgr = createZoomManager();
    mgr.setZoom(2);
    mgr.resetZoom();
    expect(mgr.getZoom()).toBe(1);
  });

  it("subscribe notifies listeners and persists to localStorage", () => {
    const mgr = createZoomManager();
    const changes: number[] = [];
    const unsub = mgr.subscribe((z) => changes.push(z));
    mgr.setZoom(1.5);
    mgr.setZoom(2);
    unsub();
    mgr.setZoom(0.8);
    expect(changes).toEqual([1.5, 2]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("0.8");
  });
});
