import { KEEP } from "@herobits/shared";

export const ARENA_VIEW_WIDTH = KEEP.WORLD_W;
export const ARENA_VIEW_HEIGHT = KEEP.WORLD_H;
export const ARENA_PIXEL_RATIO = 3;

// Straight top-down view: rendering and authoritative world coordinates coincide.
export function projectArena(x: number, y: number) {
  return { x, y, scale: 1 };
}
