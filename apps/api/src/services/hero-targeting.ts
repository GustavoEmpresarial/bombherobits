import { cellBlocked } from "@herobits/shared";

type Cell = { x: number; y: number };
export type HuntTarget = Cell & { id: string };
export type HuntPlan<T extends HuntTarget> = { target: T; path: Cell[] };
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const key = (cell: Cell) => cell.x + ',' + cell.y;

export function canAttackTarget(from: Cell, target: Cell, range: number, occupied: ReadonlySet<string>): boolean {
  if (cellBlocked(target.x, target.y) || (from.x !== target.x && from.y !== target.y)) return false;
  const distance = Math.abs(from.x - target.x) + Math.abs(from.y - target.y);
  if (distance < 1 || distance > range) return false;
  const dx = Math.sign(target.x - from.x), dy = Math.sign(target.y - from.y);
  for (let step = 1; step < distance; step++) {
    const cell = { x: from.x + dx * step, y: from.y + dy * step };
    if (cellBlocked(cell.x, cell.y) || occupied.has(key(cell))) return false;
  }
  return true;
}

// Search reachable firing positions, rather than walking toward a chest's occupied cell.
// One breadth-first search finds the fewest walking steps to any chest the hero can hit.
export function planHeroHunt<T extends HuntTarget>(from: Cell, targets: Iterable<T>, range: number, occupied: ReadonlySet<string>): HuntPlan<T> | null {
  if (cellBlocked(from.x, from.y)) return null;
  const byPosition = new Map(Array.from(targets, target => [key(target), target]));
  if (!byPosition.size) return null;

  function targetInRange(cell: Cell): T | null {
    let best: T | null = null;
    let bestDistance = Infinity;
    for (const [dx, dy] of DIRECTIONS) {
      for (let distance = 1; distance <= range; distance++) {
        const x = cell.x + dx * distance, y = cell.y + dy * distance;
        if (cellBlocked(x, y)) break;
        const cellKey = key({ x, y });
        const target = byPosition.get(cellKey);
        if (target) {
          if (distance < bestDistance) { best = target; bestDistance = distance; }
          break;
        }
        if (occupied.has(cellKey)) break;
      }
    }
    return best;
  }

  const queue: Cell[] = [from];
  const parents = new Map<string, Cell | null>([[key(from), null]]);
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    const target = targetInRange(cell);
    if (target) {
      const path: Cell[] = [];
      let current = cell;
      for (let parent = parents.get(key(current)); parent; parent = parents.get(key(current))) {
        path.push(current);
        current = parent;
      }
      return { target, path: path.reverse() };
    }
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: cell.x + dx, y: cell.y + dy }, nextKey = key(next);
      if (cellBlocked(next.x, next.y) || parents.has(nextKey) || occupied.has(nextKey) || byPosition.has(nextKey)) continue;
      parents.set(nextKey, cell);
      queue.push(next);
    }
  }
  // A temporary blockage is checked again next tick; no unreachable target stays locked.
  return null;
}
