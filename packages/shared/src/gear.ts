import type { HeroRarity } from "./index.js";

export const HERO_SKILLS = ["blacksmith", "precision", "enemyDamage", "bossDamage", "fury", "execute", "swift"] as const;
export type HeroSkill = (typeof HERO_SKILLS)[number];

export const SKILL_LABELS: Record<HeroSkill, string> = {
  blacksmith: "Quick Repair", precision: "Precision", enemyDamage: "Monster Slayer",
  bossDamage: "Boss Hunter", fury: "Fury", execute: "Execute", swift: "Swift Step",
};

export const SHIELD_MAX_LEVEL = 4;
export const SHIELD_REPAIR_UNITS_PER_SCRAP = 1200;

export const SHIELD_RULES: Record<HeroRarity, { capacity: number; repairScrap: number; upgradeScrap: number }> = {
  COMMON: { capacity: 6000, repairScrap: 5, upgradeScrap: 30 },
  RARE: { capacity: 18000, repairScrap: 15, upgradeScrap: 60 },
  SUPER_RARE: { capacity: 30000, repairScrap: 25, upgradeScrap: 120 },
  EPIC: { capacity: 54000, repairScrap: 45, upgradeScrap: 210 },
  LEGENDARY: { capacity: 90000, repairScrap: 75, upgradeScrap: 330 },
  SUPER_LEGENDARY: { capacity: 120000, repairScrap: 100, upgradeScrap: 480 },
};
export const SCRAP_PACKS = [
  { scrap: 10, gold: 100 },
  { scrap: 50, gold: 450 },
  { scrap: 200, gold: 1600 },
] as const;

export const SCRAP_YIELD: Record<HeroRarity, number> = {
  COMMON: 30, RARE: 60, SUPER_RARE: 120, EPIC: 210,
  LEGENDARY: 330, SUPER_LEGENDARY: 480,
};

export function shieldCapacity(rarity: HeroRarity, level = 1) {
  return SHIELD_RULES[rarity].capacity * level;
}

export function shieldRepairCost(rarity: HeroRarity, level: number, shield: number, shieldMax: number) {
  return shield >= shieldMax ? 0 : SHIELD_RULES[rarity].repairScrap * level;
}

export function shieldUpgradeCost(rarity: HeroRarity) {
  return SHIELD_RULES[rarity].upgradeScrap;
}
