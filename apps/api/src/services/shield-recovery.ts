export const SHIELD_RECOVERY_UNITS_PER_POINT = 240_000;

export function recoverSkilledShield(
  shield: number,
  shieldMax: number,
  savedUnits: number,
  elapsedMs: number,
) {
  if (shield >= shieldMax) return { shield: shieldMax, shieldRecoveryUnits: 0 };
  const credits = Math.max(0, savedUnits) + Math.max(0, elapsedMs);
  const nextShield = Math.min(shieldMax, shield + Math.floor(credits / SHIELD_RECOVERY_UNITS_PER_POINT));
  return {
    shield: nextShield,
    shieldRecoveryUnits: nextShield === shieldMax ? 0 : credits % SHIELD_RECOVERY_UNITS_PER_POINT,
  };
}
