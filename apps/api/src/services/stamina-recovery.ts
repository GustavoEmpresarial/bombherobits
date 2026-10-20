import { GAME } from "@herobits/shared";

// Integer credits preserve fractional stamina across frequent updates.
export const RECOVERY_UNITS_PER_POINT = 120_000;
export type RecoveryHero = {
  id: string;
  stamina: number;
  maxStamina: number;
  staminaRecoveryUnits: number;
  createdAt: Date;
};
export type RecoveryForge = { slots: number; rate: number };

export function advanceRecovery(heroes: RecoveryHero[], from: Date, to: Date, forge?: RecoveryForge, recoveryPerMinute:number = GAME.STAMINA_RECOVERY_PER_MINUTE) {
  const rows = heroes.map((hero) => ({ ...hero }));
  let cursor = from.getTime();
  const end = to.getTime();
  if (end <= cursor) return rows;
  const baseRate = recoveryPerMinute * 2;

  while (cursor < end) {
    const resting = rows.filter((hero) => hero.createdAt.getTime() <= cursor && hero.stamina < hero.maxStamina);
    const nextArrival = Math.min(end, ...rows.filter((hero) => hero.createdAt.getTime() > cursor).map((hero) => hero.createdAt.getTime()));
    if (!resting.length) {
      if (nextArrival >= end) break;
      cursor = nextArrival;
      continue;
    }
    const boosted = new Set(resting.slice(0, forge?.slots ?? 0).map((hero) => hero.id));
    const rateOf = (hero: RecoveryHero) => boosted.has(hero.id) && forge ? Math.max(baseRate, forge.rate * 2) : baseRate;
    let step = nextArrival - cursor;
    for (const hero of resting) {
      const needed = (hero.maxStamina - hero.stamina) * RECOVERY_UNITS_PER_POINT - hero.staminaRecoveryUnits;
      step = Math.min(step, Math.max(1, Math.ceil(needed / rateOf(hero))));
    }
    for (const hero of resting) {
      const credits = hero.staminaRecoveryUnits + step * rateOf(hero);
      hero.stamina = Math.min(hero.maxStamina, hero.stamina + Math.floor(credits / RECOVERY_UNITS_PER_POINT));
      hero.staminaRecoveryUnits = hero.stamina === hero.maxStamina ? 0 : Math.floor(credits % RECOVERY_UNITS_PER_POINT);
    }
    cursor += step;
  }
  return rows;
}
