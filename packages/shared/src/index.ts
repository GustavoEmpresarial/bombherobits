export type HeroClass = "WARRIOR" | "MAGE" | "ROGUE";
export type HeroRarity = "COMMON" | "RARE" | "SUPER_RARE" | "EPIC" | "LEGENDARY" | "SUPER_LEGENDARY";
export type HeroStatus = "IDLE" | "HUNTING" | "LISTED";
export type TargetType = "SLIME" | "BLOCK";
export type DungeonRunStatus = "ACTIVE" | "ENDED";

export const KEEP = {
  COLS: 41,
  ROWS: 21,
  CELL: 16,
  ORIGIN: 16,
  WORLD_W: 688,
  WORLD_H: 368,
} as const;

export function cellBlocked(x: number, y: number) {
  // One continuous walking cell separates the pillar grid from every wall.
  const pillar = x % 2 === 0 && y % 2 === 0;
  return x <= 0 || y <= 0 || x >= 40 || y >= 20 || pillar;
}

export function cellPixel(index: number) {
  return KEEP.ORIGIN + index * KEEP.CELL;
}

export function cellCenter(index: number) {
  return cellPixel(index) + KEEP.CELL / 2;
}

const STEP = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function cellKey(x: number, y: number) {
  return y * KEEP.COLS + x;
}

export function pathBetween(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blocked?: Set<string>,
): { x: number; y: number }[] {
  if (fromX === toX && fromY === toY) return [];
  if (cellBlocked(fromX, fromY) || cellBlocked(toX, toY)) return [];

  const start = cellKey(fromX, fromY);
  const goal = cellKey(toX, toY);
  const cost = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, number>();
  const open = [start];

  const heuristic = (id: number) => {
    const x = id % KEEP.COLS;
    const y = Math.floor(id / KEEP.COLS);
    return Math.abs(x - toX) + Math.abs(y - toY);
  };

  while (open.length > 0) {
    open.sort((a, b) => cost.get(a)! + heuristic(a) - (cost.get(b)! + heuristic(b)));
    const current = open.shift()!;
    if (current === goal) break;
    const x = current % KEEP.COLS;
    const y = Math.floor(current / KEEP.COLS);
    for (const [dx, dy] of STEP) {
      const nx = x + dx;
      const ny = y + dy;
      if (cellBlocked(nx, ny)) continue;
      const occupied = blocked?.has(`${nx},${ny}`) && !(nx === toX && ny === toY);
      if (occupied) continue;
      const next = cellKey(nx, ny);
      const nextCost = cost.get(current)! + 1;
      if (nextCost >= (cost.get(next) ?? Infinity)) continue;
      cost.set(next, nextCost);
      parent.set(next, current);
      if (!open.includes(next)) open.push(next);
    }
  }

  if (!parent.has(goal)) return [];
  const path: { x: number; y: number }[] = [];
  let cursor = goal;
  while (cursor !== start) {
    path.push({ x: cursor % KEEP.COLS, y: Math.floor(cursor / KEEP.COLS) });
    const previous = parent.get(cursor);
    if (previous === undefined) return [];
    cursor = previous;
  }
  path.reverse();
  return path;
}

export const GAME = {
  GRID_WIDTH: KEEP.COLS,
  GRID_HEIGHT: KEEP.ROWS,
  MAX_WORKING_HEROES: 15,
  TICK_MS: 1000,
  STAMINA_RECOVERY_PER_MINUTE: 0.5,
  STAMINA_USAGE_PER_MINUTE: 4,
  OFFLINE_CAP_HOURS: 8,
  SUMMON_COST: 100,
  STARTING_GOLD: 500,
  TARGET_COUNT: 60,
  BLOCK_RATIO: 0.2,
} as const;

export const RARITY_WEIGHTS: Record<HeroRarity, number> = { COMMON:82.87, RARE:10.36, SUPER_RARE:5.18, EPIC:1.04, LEGENDARY:0.51, SUPER_LEGENDARY:0.04 };

export const CLASS_BASE: Record<
  HeroClass,
  { atk: number; spd: number }
> = {
  WARRIOR: { atk: 8, spd: 1 },
  MAGE: { atk: 12, spd: 1 },
  ROGUE: { atk: 6, spd: 2 },
};

export const RARITY_MULT: Record<HeroRarity, number> = { COMMON:1, RARE:1.35, SUPER_RARE:1.6, EPIC:1.8, LEGENDARY:2.5, SUPER_LEGENDARY:3.2 };

export const TARGET_STATS: Record<
  TargetType,
  { maxHp: number; goldReward: number }
> = {
  SLIME: { maxHp: 40, goldReward: 2.5 },
  BLOCK: { maxHp: 80, goldReward: 5 },
};

export interface HeroDto {
  id: string;
  class: HeroClass;
  rarity: HeroRarity;
  level: number;
  atk: number;
  spd: number;
  stamina: number;
  maxStamina: number;
  status: HeroStatus;
  dungeonX: number | null;
  dungeonY: number | null;
}

export interface TargetDto {
  kind?: import("./config.js").LootKind;
  id: string;
  type: TargetType;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
}

export interface DungeonCombatEvent {
  sequence: number;
  heroId: string;
  heroClass: HeroClass;
  targetId: string;
  targetType: TargetType;
  kind?: import("./config.js").LootKind;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  damage: number;
  destroyed: boolean;
  reward: number;
  at: string;
}

export interface DungeonSnapshot {
  runId: string;
  wave: number;
  waveTotal: number;
  openedCrates: number;
  combatSequence: number;
  combatEvents: DungeonCombatEvent[];
  visual?: RuntimeVisualConfig;
  status: DungeonRunStatus;
  gold: number;
  chest: number;
  working: number;
  maxWorking: number;
  heroes: HeroDto[];
  targets: TargetDto[];
  lastTickAt: string;
}

export const BLACKSMITHS = [
  { tier: 1, name: "Apprentice Smith", slots: 4, rate: 2, price: 400 },
  { tier: 2, name: "Journeyman Smith", slots: 6, rate: 5, price: 900 },
  { tier: 3, name: "Artisan Smith", slots: 8, rate: 8, price: 1600 },
  { tier: 4, name: "Master Smith", slots: 10, rate: 11, price: 2800 },
  { tier: 5, name: "Grandmaster Smith", slots: 12, rate: 14, price: 4500 },
  { tier: 6, name: "Legendary Smith", slots: 14, rate: 17, price: 7000 },
] as const;

export const ECONOMY = {
  PORTER_PRICE: 600,
  MARKET_FEE: 0.05,
  WITHDRAW_MIN: 50,
  WITHDRAW_FEE: 0.03,
  MINT_PACKS: [1, 5, 10],
  MAX_ACTIVE: 50,
} as const;

export interface UserDto {
  id: string;
  wallet: string;
  gold: number;
  chest: number;
  mintCards: number;
  inviteCode: string;
  porterOn: boolean;
  displayName: string;
}

export interface AuthNonceResponse {
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

export { DEFAULT_CONFIG, LOOT_KINDS } from "./config.js";
export type { RuntimeConfig, ConfigSection, LootKind } from "./config.js";

export type RuntimeVisualConfig = import("./config.js").RuntimeConfig["visual"];

export { ARENA_THEMES, arenaTheme } from "./arena-themes.js";

export { HERO_RARITIES, RARITY_INFO } from "./rarities.js";
export type SummonCardDto = { slot:number; class:HeroClass; rarity:HeroRarity; atk:number; spd:number; maxStamina:number };
export type SummonBatchDto = { id:string; requestId:string; source:"GOLD"|"CARDS"; status:"SEALED"|"REVEALED"|"CLAIMED"; count:number; createdAt:string; cards?:SummonCardDto[] };
export type SummonPurchaseDto = { batch:SummonBatchDto; user:UserDto };
export type SummonClaimDto = { batchId:string; heroes:HeroDto[]; user:UserDto };
export * from "./creators.js";
export * from "./marketing.js";
