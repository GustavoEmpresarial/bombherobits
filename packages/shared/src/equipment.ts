export const GEAR_SLOTS = ["HELM", "ARMOR", "BOOTS"] as const;
export const GEAR_ELEMENTS = ["FIRE", "STORM", "FROST"] as const;
export const GEAR_RARITIES = ["STEEL", "GREEN", "BLUE", "PURPLE", "GOLD"] as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export type GearElement = typeof GEAR_ELEMENTS[number];
export type GearRarity = typeof GEAR_RARITIES[number];

export const GEAR_RULES: Record<GearRarity, { price: number; attack: [number, number]; shield: number; repair: number; salvage: number; fusion: number }> = {
  STEEL: { price: 150, attack: [2, 5], shield: 1200, repair: 2, salvage: 3, fusion: 12 },
  GREEN: { price: 450, attack: [6, 9], shield: 2400, repair: 4, salvage: 7, fusion: 24 },
  BLUE: { price: 1200, attack: [10, 15], shield: 4800, repair: 8, salvage: 15, fusion: 48 },
  PURPLE: { price: 3000, attack: [16, 22], shield: 8400, repair: 16, salvage: 32, fusion: 96 },
  GOLD: { price: 7500, attack: [23, 29], shield: 10800, repair: 32, salvage: 64, fusion: 0 },
};

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
