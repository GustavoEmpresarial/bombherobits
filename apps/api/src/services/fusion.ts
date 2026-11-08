import { Prisma, type HeroClass, type HeroRarity } from "@prisma/client";
import { FUSION_CRITICAL_CHANCE, FUSION_INPUT_COUNT, fusionResultRarity, shieldCapacity, type FusionResultDto } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toHeroDto } from "../lib/mappers.js";
import { getConfig } from "./config.js";
import { processTicks } from "./dungeon.js";
import { heroStats } from "./summon.js";
import { rollHeroSkills } from "./hero-skills.js";

const CLASSES: HeroClass[] = ["WARRIOR", "MAGE", "ROGUE"];
const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export function validateFusionIds(ids: string[]): string[] {
  if (ids.length !== FUSION_INPUT_COUNT || ids.some((id) => !id || id.length > 128)) {
    throw fail(`Choose ${FUSION_INPUT_COUNT} heroes`);
  }
  const unique = [...new Set(ids)].sort();
  if (unique.length !== FUSION_INPUT_COUNT) throw fail("Choose four different heroes");
  return unique;
}

export async function fuseHeroes(userId: string, selectedIds: string[], requestKey: string): Promise<FusionResultDto> {
  const ids = validateFusionIds(selectedIds);
  if (!requestKey || requestKey.length > 128) throw fail("Invalid fusion request");
  await processTicks(userId);
  const config = await getConfig();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const previous = await tx.fusion.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
    if (previous) {
      if (JSON.stringify(previous.sourceIds) !== JSON.stringify(ids)) throw fail("This request was already used for another fusion", 409);
      const result = await tx.hero.findUnique({ where: { id: previous.resultHeroId } });
      if (!result) throw fail("Fusion result is no longer available", 409);
      return {
        sourceIds: ids,
        sourceRarity: previous.sourceRarity,
        resultRarity: previous.resultRarity,
        critical: previous.critical,
        hero: toHeroDto(result),
      };
    }

    await tx.$queryRaw`SELECT "id" FROM "Hero" WHERE "id" IN (${Prisma.join(ids)}) FOR UPDATE`;
    const heroes = await tx.hero.findMany({ where: { id: { in: ids }, userId } });
    if (heroes.length !== FUSION_INPUT_COUNT) throw fail("One or more heroes are no longer yours", 409);
    const sourceRarity = heroes[0].rarity;
    if (heroes.some((hero) => hero.rarity !== sourceRarity)) throw fail("All four heroes must have the same rarity");
    if (heroes.some((hero) => hero.status !== "IDLE")) throw fail("Rest every hero before fusing");
    if (await tx.listing.count({ where: { refId: { in: ids }, kind: "HERO", status: "OPEN" } })) {
      throw fail("Remove heroes from the market before fusing");
    }
    if (fusionResultRarity(sourceRarity, false) === null) throw fail("This rarity cannot be fused");

    const critical = Math.random() < FUSION_CRITICAL_CHANCE;
    const resultRarity = fusionResultRarity(sourceRarity, critical) as HeroRarity;
    const heroClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
    const stats = heroStats(heroClass, resultRarity, config);
    const removed = await tx.hero.deleteMany({ where: { id: { in: ids }, userId, status: "IDLE" } });
    if (removed.count !== FUSION_INPUT_COUNT) throw fail("Hero selection changed. Try again.", 409);
    const result = await tx.hero.create({ data: { userId, class: heroClass, rarity: resultRarity, shield: shieldCapacity(resultRarity), shieldMax: shieldCapacity(resultRarity), skills: rollHeroSkills(resultRarity), ...stats } });
    await tx.fusion.create({ data: {
      userId, requestKey, sourceIds: ids, sourceRarity, resultRarity, resultHeroId: result.id, critical,
    } });
    return { sourceIds: ids, sourceRarity, resultRarity, critical, hero: toHeroDto(result) };
  }, { timeout: 15000 });
}
