import { getConfig } from "./config.js";
import { prisma } from "../lib/prisma.js";
import { advanceRecovery } from "./stamina-recovery.js";
import { recoverSkilledShield } from "./shield-recovery.js";

export async function recoverStamina(userId: string, at = new Date()) {
  const config=await getConfig();const BLACKSMITHS=config.blacksmiths;
  await prisma.$transaction(async (tx) => {
    // One persisted clock per player; multiple tabs cannot credit the same time twice.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (at.getTime() <= user.staminaUpdatedAt.getTime()) return;
    const [heroes, smith, porters] = await Promise.all([
      tx.hero.findMany({ where: { userId, status: "IDLE" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      tx.blacksmith.findFirst({ where: { userId, inService: true }, orderBy: { tier: "desc" } }),
      user.porterOn ? tx.porter.count({ where: { userId } }) : Promise.resolve(0),
    ]);
    const forge = smith ? BLACKSMITHS.find((spec) => spec.tier === smith.tier) : undefined;
    const recovered = advanceRecovery(heroes, user.staminaUpdatedAt, at, forge, config.stamina.recoveryPerMinute, user.porterOn && porters > 0);
    for (let index = 0; index < heroes.length; index++) {
      const previous = heroes[index];
      const next = recovered[index];
      const skilled = Array.isArray(previous.skills) && previous.skills.includes("blacksmith");
      const from = Math.max(user.staminaUpdatedAt.getTime(), previous.createdAt.getTime());
      const shield = skilled
        ? recoverSkilledShield(previous.shield, previous.shieldMax, previous.shieldRecoveryUnits, at.getTime() - from)
        : { shield: previous.shield, shieldRecoveryUnits: previous.shieldRecoveryUnits };
      if (previous.stamina === next.stamina && previous.staminaRecoveryUnits === next.staminaRecoveryUnits
        && previous.shield === shield.shield && previous.shieldRecoveryUnits === shield.shieldRecoveryUnits) continue;
      await tx.hero.update({ where: { id: next.id }, data: { stamina: next.stamina, staminaRecoveryUnits: next.staminaRecoveryUnits, ...shield } });
    }
    await tx.user.update({ where: { id: userId }, data: { staminaUpdatedAt: at } });
  }, { timeout: 15_000 });
}
