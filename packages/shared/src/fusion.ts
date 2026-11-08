import type { HeroRarity } from "./index.js";

export const FUSION_STEPS = [
  "COMMON",
  "RARE",
  "SUPER_RARE",
  "EPIC",
  "LEGENDARY",
  "SUPER_LEGENDARY",
] as const satisfies readonly HeroRarity[];

export const FUSION_INPUT_COUNT = 4;
export const FUSION_CRITICAL_CHANCE = 0.01;

export function fusionResultRarity(source: HeroRarity, critical: boolean): HeroRarity | null {
  const index = FUSION_STEPS.indexOf(source);
  if (index < 0 || index >= FUSION_STEPS.length - 2) return null;
  return FUSION_STEPS[Math.min(index + (critical ? 2 : 1), FUSION_STEPS.length - 1)];
}

export interface FusionResultDto {
  sourceIds: string[];
  sourceRarity: HeroRarity;
  resultRarity: HeroRarity;
  critical: boolean;
  hero: import("./index.js").HeroDto;
}
