import type { HeroRarity } from "@prisma/client";
import { HERO_SKILLS, type HeroSkill } from "@herobits/shared";

const skillCount: Record<HeroRarity, number> = {
  COMMON: 1, RARE: 2, SUPER_RARE: 3, EPIC: 4, LEGENDARY: 5, SUPER_LEGENDARY: 6,
};
const weights: Record<HeroSkill, number> = {
  blacksmith: 12, precision: 12, enemyDamage: 6, bossDamage: 20,
  fury: 8, execute: 9, swift: 16,
};

export function rollHeroSkills(rarity: HeroRarity, random = Math.random): HeroSkill[] {
  const pool = [...HERO_SKILLS];
  const result: HeroSkill[] = [];
  while (result.length < skillCount[rarity]) {
    const total = pool.reduce((sum, skill) => sum + weights[skill], 0);
    let roll = random() * total;
    const index = Math.max(0, pool.findIndex((skill) => (roll -= weights[skill]) < 0));
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
