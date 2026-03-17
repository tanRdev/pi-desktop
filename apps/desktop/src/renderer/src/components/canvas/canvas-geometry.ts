/**
 * Pure geometry helpers for canvas window drag/resize math.
 * Kept minimal and deterministic so tests can assert exact snapping behavior.
 */

export type MousePoint = { clientX: number; clientY: number };
export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

function snapToGrid(value: number, gridSize: number) {
  if (!gridSize) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Compute a snapped drag position.
 * startWindow: origin x/y of the window at drag start
 * mouseStart / mouseCurrent: mouse coordinates
 */
export function computeDragPosition(
  startWindow: { x: number; y: number },
  mouseStart: MousePoint,
  mouseCurrent: MousePoint,
  gridSize: number,
): Point {
  const dx = mouseCurrent.clientX - mouseStart.clientX;
  const dy = mouseCurrent.clientY - mouseStart.clientY;

  const newX = startWindow.x + dx;
  const newY = startWindow.y + dy;

  return { x: snapToGrid(newX, gridSize), y: snapToGrid(newY, gridSize) };
}

/**
 * Compute resize geometry (x/y/width/height) given a start rect and pointer delta.
 * Behavior mirrors the inline math used elsewhere:
 * - e/s: grow width/height by dx/dy
 * - w/n: shrink and move origin by dx/dy
 * - min size enforced (width 300, height 200)
 * - width/height/x/y snapped to grid
 * - origin is only moved for west/north directions
 */
export function computeResizeGeometry(
  startWindow: Rect,
  direction: string,
  mouseStart: MousePoint,
  mouseCurrent: MousePoint,
  gridSize: number,
): Rect {
  const dx = mouseCurrent.clientX - mouseStart.clientX;
  const dy = mouseCurrent.clientY - mouseStart.clientY;

  let newWidth = startWindow.width;
  let newHeight = startWindow.height;
  let newX = startWindow.x;
  let newY = startWindow.y;

  if (direction.includes("e")) newWidth += dx;
  if (direction.includes("w")) {
    newWidth -= dx;
    newX += dx;
  }
  if (direction.includes("s")) newHeight += dy;
  if (direction.includes("n")) {
    newHeight -= dy;
    newY += dy;
  }

  const minWidth = 300;
  const minHeight = 200;
  newWidth = Math.max(minWidth, newWidth);
  newHeight = Math.max(minHeight, newHeight);

  let snappedWidth = snapToGrid(newWidth, gridSize);
  let snappedHeight = snapToGrid(newHeight, gridSize);
  const snappedX = snapToGrid(newX, gridSize);
  const snappedY = snapToGrid(newY, gridSize);

  // Ensure final snapped sizes respect minimums (snapping can round down),
  // so if rounding produced a value below the min, round up to the
  // next grid multiple that satisfies the minimum.
  if (snappedWidth < minWidth) {
    snappedWidth = Math.ceil(minWidth / gridSize) * gridSize;
  }
  if (snappedHeight < minHeight) {
    snappedHeight = Math.ceil(minHeight / gridSize) * gridSize;
  }

  return {
    x: direction.includes("w") ? snappedX : startWindow.x,
    y: direction.includes("n") ? snappedY : startWindow.y,
    width: snappedWidth,
    height: snappedHeight,
  };
}
