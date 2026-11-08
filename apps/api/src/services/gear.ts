import { Prisma } from "@prisma/client";
import { SCRAP_PACKS, SCRAP_YIELD, SHIELD_MAX_LEVEL, SHIELD_RULES, shieldRepairCost, shieldUpgradeCost } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toHeroDto, toUserDto } from "../lib/mappers.js";
import { processTicks } from "./dungeon.js";

const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });

async function lockOwnerAndHero(tx: Prisma.TransactionClient, userId: string, heroId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Hero" WHERE "id" = ${heroId} FOR UPDATE`;
  const hero = await tx.hero.findFirst({ where: { id: heroId, userId } });
  if (!hero) throw fail("Hero not found", 404);
  return hero;
}

export async function scrapHero(userId: string, heroId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    const hero = await lockOwnerAndHero(tx, userId, heroId);
    if (hero.status !== "IDLE") throw fail("Rest and unlist the hero before scrapping it");
    const amount = SCRAP_YIELD[hero.rarity];
    const removed = await tx.hero.deleteMany({ where: { id: heroId, userId, status: "IDLE" } });
    if (!removed.count) throw fail("Hero status changed. Try again.", 409);
    const user = await tx.user.update({ where: { id: userId }, data: { scrap: { increment: amount } } });
    return { scrapReceived: amount, user: toUserDto(user) };
  });
}

export async function buyScrap(userId: string, amount: number, source: "gold" | "chest" = "gold") {
  const pack = SCRAP_PACKS.find((entry) => entry.scrap === amount);
  if (!pack) throw fail("Choose an available Scrap pack");
  if (source !== "gold" && source !== "chest") throw fail("Choose game gold or hunting chest");
  return prisma.$transaction(async (tx) => {
    const paid = await tx.user.updateMany({
      where: { id: userId, [source]: { gte: pack.gold } },
      data: { [source]: { decrement: pack.gold }, scrap: { increment: pack.scrap } },
    });
    if (!paid.count) throw fail(`Need ${pack.gold} ${source === "chest" ? "in the hunting chest" : "gold"} to buy ${pack.scrap} Scrap`);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { scrap: pack.scrap, cost: pack.gold, source, user: toUserDto(user) };
  });
}

export async function repairShield(userId: string, heroId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    const hero = await lockOwnerAndHero(tx, userId, heroId);
    if (hero.status !== "IDLE") throw fail("Rest and unlist the hero before repairing its shield");
    const cost = shieldRepairCost(hero.rarity, hero.shieldLevel, hero.shield, hero.shieldMax);
    if (!cost) throw fail("Shield is already full");
    const paid = await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } });
    if (!paid.count) throw fail(`Need ${cost} Scrap to repair this shield`);
    const updated = await tx.hero.update({ where: { id: hero.id }, data: { shield: hero.shieldMax, shieldRecoveryUnits: 0 } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { cost, hero: toHeroDto(updated), user: toUserDto(user) };
  });
}

export async function upgradeShield(userId: string, heroId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    const hero = await lockOwnerAndHero(tx, userId, heroId);
    if (hero.status !== "IDLE") throw fail("Rest and unlist the hero before upgrading its shield");
    if (hero.shieldLevel >= SHIELD_MAX_LEVEL) throw fail("Shield is at its maximum level");
    const cost = shieldUpgradeCost(hero.rarity);
    const paid = await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } });
    if (!paid.count) throw fail(`Need ${cost} Scrap to upgrade this shield`);
    const updated = await tx.hero.update({ where: { id: hero.id }, data: {
      shieldLevel: { increment: 1 }, shieldMax: { increment: SHIELD_RULES[hero.rarity].capacity },
    } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { cost, hero: toHeroDto(updated), user: toUserDto(user) };
  });
}
