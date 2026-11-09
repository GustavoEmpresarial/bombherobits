export const GEAR_SLOTS = ["HELM", "ARMOR", "BOOTS"] as const;
export const GEAR_ELEMENTS = ["FIRE", "STORM", "FROST"] as const;
export const GEAR_RARITIES = ["STEEL", "GREEN", "BLUE", "PURPLE", "GOLD", "MYTHIC"] as const;
export const GEAR_BOXES = ["STEEL", "GREEN", "BLUE"] as const;
export const GEAR_WEIGHTS = [6000, 2500, 1000, 350, 120, 30] as const;
export const GEAR_PITY_LIMITS = { blue: 15, purple: 50, gold: 150 } as const;
export const GEAR_LABELS = { STEEL: "Common", GREEN: "Uncommon", BLUE: "Rare", PURPLE: "Epic", GOLD: "Legendary", MYTHIC: "Mythic" } as const;
export const GEAR_BOX_LABELS = { STEEL: "Gear Box", GREEN: "Green Gear Box", BLUE: "Blue Gear Box" } as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export type GearElement = typeof GEAR_ELEMENTS[number];
export type GearRarity = typeof GEAR_RARITIES[number];
export type GearBox = typeof GEAR_BOXES[number];
export type GearPity = { blue: number; purple: number; gold: number };

export const GEAR_RULES: Record<GearRarity, { price: number; attack: [number, number]; shield: number; repair: number; salvage: number; fusion: number }> = {
  STEEL: { price: 10000, attack: [2, 5], shield: 1200, repair: 1, salvage: 3, fusion: 12 },
  GREEN: { price: 20000, attack: [6, 9], shield: 2400, repair: 2, salvage: 7, fusion: 24 },
  BLUE: { price: 35000, attack: [10, 15], shield: 4800, repair: 4, salvage: 15, fusion: 48 },
  PURPLE: { price: 0, attack: [16, 22], shield: 8400, repair: 7, salvage: 32, fusion: 96 },
  GOLD: { price: 0, attack: [23, 29], shield: 10800, repair: 9, salvage: 64, fusion: 192 },
  MYTHIC: { price: 0, attack: [30, 38], shield: 20400, repair: 17, salvage: 128, fusion: 0 },
};

export function chooseGearRarity(box: GearBox, draw: number): GearRarity {
  const minimum = GEAR_RARITIES.indexOf(box);
  const total = GEAR_WEIGHTS.slice(minimum).reduce((sum, weight) => sum + weight, 0);
  if (!Number.isInteger(draw) || draw < 0 || draw >= total) throw new RangeError("Invalid gear rarity draw");
  let remaining = draw;
  for (let index = minimum; index < GEAR_RARITIES.length; index++) {
    remaining -= GEAR_WEIGHTS[index];
    if (remaining < 0) return GEAR_RARITIES[index];
  }
  throw new RangeError("Invalid gear rarity weights");
}

export function gearRarityDrawSize(box: GearBox): number {
  return GEAR_WEIGHTS.slice(GEAR_RARITIES.indexOf(box)).reduce((sum, weight) => sum + weight, 0);
}

export function advanceGearPity(rolled: GearRarity, current: GearPity): { rarity: GearRarity; pity: GearPity } {
  const guaranteed: GearRarity = current.gold + 1 >= GEAR_PITY_LIMITS.gold ? "GOLD"
    : current.purple + 1 >= GEAR_PITY_LIMITS.purple ? "PURPLE"
      : current.blue + 1 >= GEAR_PITY_LIMITS.blue ? "BLUE" : rolled;
  const rarity = guaranteed;
  return { rarity, pity: {
    blue: rarity === "BLUE" ? 0 : Math.min(GEAR_PITY_LIMITS.blue - 1, current.blue + 1),
    purple: rarity === "PURPLE" ? 0 : Math.min(GEAR_PITY_LIMITS.purple - 1, current.purple + 1),
    gold: rarity === "GOLD" || rarity === "MYTHIC" ? 0 : Math.min(GEAR_PITY_LIMITS.gold - 1, current.gold + 1),
  } };
}

export interface GearPieceDto {
  id: string;
  heroId: string | null;
  slot: GearSlot;
  element: GearElement;
  rarity: GearRarity;
  attack: number;
  shield: number;
  shieldMax: number;
  lastHeroId: string | null;
  movedDay: string | null;
}

export function equipmentAttack(pieces: ReadonlyArray<Pick<GearPieceDto, "element" | "attack" | "shield">>): number {
  const setBonus = pieces.length === 3 && pieces.every((piece) => piece.shield > 0 && piece.element === pieces[0].element);
  return pieces.reduce((sum, piece) => sum + (piece.shield > 0 ? piece.attack + (setBonus ? Math.round(piece.attack * 0.1) : 0) : 0), 0);
}
