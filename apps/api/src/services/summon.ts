import {
  RARITY_WEIGHTS,
  type HeroClass,
  type HeroRarity,
} from "@herobits/shared";

import type { RuntimeConfig } from "@herobits/shared";
import { gameRules,peekConfig } from "./config.js";

const CLASSES: HeroClass[] = ["WARRIOR", "MAGE", "ROGUE"];
const RARITIES = Object.keys(RARITY_WEIGHTS) as HeroRarity[];

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (w > 0 && roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function heroStats(heroClass:HeroClass,rarity:HeroRarity,config:RuntimeConfig=peekConfig()) {
  const base=config.heroes.classes[heroClass];
  const range=config.stamina.rarityPoints[rarity];
  const points=range.min+Math.floor(Math.random()*(range.max-range.min+1));
  const maxStamina=points*config.stamina.energyPerPoint;
  return {atk:Math.round(base.atk*config.heroes.rarityMultipliers[rarity]),spd:base.spd,maxStamina,stamina:maxStamina};
}

export function rollHero(config:RuntimeConfig=peekConfig()) {
  const {GAME,RARITY_WEIGHTS}=gameRules(config);
  const heroClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
  const rarity = pickWeighted(RARITY_WEIGHTS);
  return {
    class: heroClass,
    rarity,
    ...heroStats(heroClass,rarity,config),
    cost: GAME.SUMMON_COST,
  };
}

export { RARITIES };
