import { describe, expect, it } from "vitest";

import {
  computeDragPosition,
  computeResizeGeometry,
} from "../../../apps/desktop/src/renderer/src/components/canvas/canvas-geometry";

describe("canvas-geometry", () => {
  it("snaps drag position from a positive delta", () => {
    const startWindow = { x: 10, y: 10 };
    const mouseStart = { clientX: 5, clientY: 5 };
    const mouseCurrent = { clientX: 17, clientY: 20 };
    const gridSize = 10;

    const pos = computeDragPosition(
      startWindow,
      mouseStart,
      mouseCurrent,
      gridSize,
    );

    // start (10,10) + dx=12,dy=15 -> (22,25) -> snapped to grid 10 -> (20,30)
    expect(pos).toEqual({ x: 20, y: 30 });
  });

  it("snaps drag position from a negative delta", () => {
    const startWindow = { x: 50, y: 50 };
    const mouseStart = { clientX: 100, clientY: 100 };
    const mouseCurrent = { clientX: 92, clientY: 88 };
    const gridSize = 10;

    const pos = computeDragPosition(
      startWindow,
      mouseStart,
      mouseCurrent,
      gridSize,
    );

    // start (50,50) + dx=-8,dy=-12 -> (42,38) -> snapped to grid 10 -> (40,40)
    expect(pos).toEqual({ x: 40, y: 40 });
  });

  it("resizes southeast (growth) while preserving origin and snapping width/height", () => {
    const startWindow = { x: 100, y: 100, width: 400, height: 300 };
    const mouseStart = { clientX: 200, clientY: 200 };
    const mouseCurrent = { clientX: 250, clientY: 260 }; // dx=50, dy=60
    const gridSize = 50;

    const g = computeResizeGeometry(
      startWindow,
      "se",
      mouseStart,
      mouseCurrent,
      gridSize,
    );

    // width: 400+50=450 -> snapped to 450; height: 300+60=360 -> snapped to 350
    // origin should remain at original x/y
    expect(g).toEqual({ x: 100, y: 100, width: 450, height: 350 });
  });

  it("resizes northwest and moves origin while snapping", () => {
    const startWindow = { x: 200, y: 200, width: 400, height: 300 };
    const mouseStart = { clientX: 200, clientY: 200 };
    const mouseCurrent = { clientX: 150, clientY: 130 }; // dx=-50, dy=-70
    const gridSize = 10;

    const g = computeResizeGeometry(
      startWindow,
      "nw",
      mouseStart,
      mouseCurrent,
      gridSize,
    );

    // width: 400 - (-50) = 450 -> snapped 450
    // height: 300 - (-70) = 370 -> snapped 370
    // origin: x=200 + (-50) = 150, y=200 + (-70) = 130 -> snapped
    expect(g).toEqual({ x: 150, y: 130, width: 450, height: 370 });
  });

  it("enforces minimum size constraints after snapping", () => {
    const startWindow = { x: 0, y: 0, width: 320, height: 220 };
    const mouseStart = { clientX: 100, clientY: 100 };
    const mouseCurrent = { clientX: 0, clientY: 0 }; // dx=-100, dy=-100
    const gridSize = 32; // choose a grid size that could otherwise round down

    const g = computeResizeGeometry(
      startWindow,
      "e",
      mouseStart,
      mouseCurrent,
      gridSize,
    );

    // attempt to shrink below min (minWidth=300, minHeight=200)
    // final snapped values must still respect the minimum constraints
    expect(g.width).toBeGreaterThanOrEqual(300);
    expect(g.height).toBeGreaterThanOrEqual(200);
  });
});
