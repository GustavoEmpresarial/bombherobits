import type { HeroRarity } from "./index.js";

export const SUMMON_PITY_LIMITS = { rare: 15, superRare: 50, epic: 100 } as const;

export type SummonPity = { rare: number; superRare: number; epic: number };

export const EMPTY_SUMMON_PITY: SummonPity = { rare: 0, superRare: 0, epic: 0 };

export function advanceSummonPity(rolled: HeroRarity, current: SummonPity): { rarity: HeroRarity; pity: SummonPity } {
  // A card that fills a bar is guaranteed that exact rarity. If bars fill
  // together, the higher guarantee wins and the other stays due next time.
  const rarity: HeroRarity = current.epic + 1 >= SUMMON_PITY_LIMITS.epic ? "EPIC"
    : current.superRare + 1 >= SUMMON_PITY_LIMITS.superRare ? "SUPER_RARE"
      : current.rare + 1 >= SUMMON_PITY_LIMITS.rare ? "RARE" : rolled;
  return { rarity, pity: {
    rare: rarity === "RARE" ? 0 : Math.min(SUMMON_PITY_LIMITS.rare - 1, current.rare + 1),
    superRare: rarity === "SUPER_RARE" ? 0 : Math.min(SUMMON_PITY_LIMITS.superRare - 1, current.superRare + 1),
    epic: ["EPIC", "LEGENDARY", "SUPER_LEGENDARY"].includes(rarity) ? 0
      : Math.min(SUMMON_PITY_LIMITS.epic - 1, current.epic + 1),
  } };
}
