import { GAME } from "@herobits/shared";

const UNITS_PER_POINT = 60_000;

export function consumeStamina(stamina: number, usageUnits: number, elapsedMs: number, rate:number = GAME.STAMINA_USAGE_PER_MINUTE) {
  if (stamina <= 0) return { stamina: 0, staminaUsageUnits: 0 };
  const units = usageUnits + Math.max(0, elapsedMs) * rate;
  const remaining = Math.max(0, stamina - Math.floor(units / UNITS_PER_POINT));
  return { stamina: remaining, staminaUsageUnits: remaining === 0 ? 0 : units % UNITS_PER_POINT };
}
