import { KEEP, cellBlocked, cellCenter, pathBetween } from "@herobits/shared";

export function lootDisplaySize(scale = 0.6) {
  return Math.min(KEEP.CELL - 2, 12 * scale / 0.6);
}

// Replan from the interpolated on-screen position, not a server cell still being approached.
// First finish an axis-aligned segment to a valid cell center, then follow the grid route.
export function visualWalkWaypoints(px: number, py: number, x: number, y: number) {
  const ax = Math.round((px - KEEP.ORIGIN - KEEP.CELL / 2) / KEEP.CELL);
  const ay = Math.round((py - KEEP.ORIGIN - KEEP.CELL / 2) / KEEP.CELL);
  if (cellBlocked(ax, ay) || cellBlocked(x, y)) return [];
  const path = pathBetween(ax, ay, x, y);
  if ((ax !== x || ay !== y) && !path.length) return [];
  return [{ x: cellCenter(ax), y: cellCenter(ay) }, ...path.map(cell => ({x:cellCenter(cell.x),y:cellCenter(cell.y)}))]
    .filter((point, index) => index !== 0 || Math.abs(point.x-px) + Math.abs(point.y-py) > 0.01);
}
