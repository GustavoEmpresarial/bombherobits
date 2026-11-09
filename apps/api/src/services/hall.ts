import { randomInt } from "node:crypto";
import type { HeroClass, HeroRarity } from "@herobits/shared";
import { GEAR_ELEMENTS, GEAR_RULES, GEAR_SLOTS, chooseGearRarity, gearRarityDrawSize, shieldCapacity } from "@herobits/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getConfig } from "./config.js";
import { processTicks } from "./dungeon.js";
import { rollHeroSkills } from "./hero-skills.js";
import { heroStats } from "./summon.js";

const DAY = 86_400_000;
const SEASON_START = Date.UTC(2026, 10, 4);
const EVENT_END = Date.UTC(2026, 10, 11);
const BASE_GLORY: Record<HeroRarity, number> = {
  COMMON: 600, RARE: 1200, SUPER_RARE: 2400, EPIC: 4800, LEGENDARY: 9600, SUPER_LEGENDARY: 19200,
};
const MILESTONES = [
  { points: 100, label: "40 Scrap", scrap: 40 },
  { points: 400, label: "Summon card", cards: 1 },
  { points: 1000, label: "Summon + Scrap", cards: 1, scrap: 40 },
  { points: 2000, label: "Green gear box", box: "GREEN" as const },
  { points: 3500, label: "Summon + Scrap", cards: 1, scrap: 80 },
  { points: 5000, label: "Epic hero", hero: "EPIC" as const },
  { points: 8000, label: "Blue box + Summon", box: "BLUE" as const, cards: 1 },
  { points: 12000, label: "Legendary hero", hero: "LEGENDARY" as const },
] as const;
const RACES = [
  { points: 3000, label: "Epic hero", rarity: "EPIC" as const, seats: 50 },
  { points: 10000, label: "Legendary hero", rarity: "LEGENDARY" as const, seats: 20 },
  { points: 30000, label: "Mythic hero", rarity: "SUPER_LEGENDARY" as const, seats: 5 },
] as const;
const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const seasonInfo = (now = new Date()) => {
  const season = Math.max(0, Math.floor((now.getTime() - SEASON_START) / (14 * DAY)));
  const startsAt = new Date(SEASON_START + season * 14 * DAY);
  return { season: season + 1, startsAt, endsAt: new Date(startsAt.getTime() + 14 * DAY), multiplier: now.getTime() < EVENT_END ? 2 : 1 };
};
type RankingRow = { userId: string; displayName: string; glory: bigint; retired: bigint; rank: bigint };

export async function hallState(userId: string, now = new Date()) {
  const season = seasonInfo(now);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { wallet: true } });
  const demo = owner.wallet.startsWith("demo:");
  const [retirements, claims, raceClaims, rows] = await Promise.all([
    prisma.hallRetirement.findMany({ where: { userId, season: season.season }, select: { glory: true } }),
    prisma.hallClaim.findMany({ where: { userId, season: season.season }, select: { milestone: true } }),
    prisma.hallRaceClaim.findMany({ where: { season: season.season }, select: { userId: true, threshold: true } }),
    prisma.$queryRaw<RankingRow[]>`
      WITH totals AS (
        SELECT r."userId", u."displayName", SUM(r."glory")::bigint AS glory, COUNT(*)::bigint AS retired
        FROM "HallRetirement" r JOIN "User" u ON u."id" = r."userId"
        WHERE r."season" = ${season.season} AND (u."wallet" LIKE 'demo:%') = ${demo}
        GROUP BY r."userId", u."displayName"
      ), ranked AS (
        SELECT *, RANK() OVER (ORDER BY glory DESC, retired DESC) AS rank FROM totals
      )
      SELECT * FROM ranked WHERE rank <= 100 OR "userId" = ${userId}
      ORDER BY rank, "userId"
    `,
  ]);
  const glory = retirements.reduce((sum, row) => sum + row.glory, 0);
  const claimed = new Set(claims.map(row => row.milestone));
  const recurring = Array.from({ length: Math.min(50, Math.max(0, Math.floor((glory - 12000) / 2000))) }, (_, index) => ({ points: 14000 + index * 2000, label: "Summon + 40 Scrap", cards: 1, scrap: 40 }));
  const ranked = rows.map(row => ({ userId: row.userId, displayName: row.displayName, glory: Number(row.glory), retired: Number(row.retired), rank: Number(row.rank) }));
  const standings = ranked.filter(row => row.rank <= 100);
  return {
    season: season.season, startsAt: season.startsAt.toISOString(), endsAt: season.endsAt.toISOString(), multiplier: season.multiplier,
    glory, retired: retirements.length,
    milestones: [...MILESTONES, ...recurring].map(item => ({ points: item.points, label: item.label, claimed: claimed.has(item.points), unlocked: glory >= item.points })),
    races: RACES.map(race => ({ points: race.points, label: race.label, seats: race.seats, left: Math.max(0, race.seats - raceClaims.filter(row => row.threshold === race.points).length), claimed: raceClaims.some(row => row.userId === userId && row.threshold === race.points), unlocked: glory >= race.points })),
    standings, me: ranked.find(row => row.userId === userId) ?? null,
    gloryByRarity: Object.fromEntries(Object.entries(BASE_GLORY).map(([rarity, value]) => [rarity, value * season.multiplier])),
  };
}

export async function retireHeroes(userId: string, heroIds: string[], requestKey: string) {
  if (!Array.isArray(heroIds) || heroIds.length < 1 || heroIds.length > 15 || new Set(heroIds).size !== heroIds.length || heroIds.some(id => typeof id !== "string" || !id)) throw fail("Choose 1 to 15 distinct heroes");
  if (typeof requestKey !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestKey)) throw fail("Invalid retirement request key");
  await processTicks(userId);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const prior = await tx.hallRetirement.findMany({ where: { userId, requestKey }, select: { heroId: true } });
    if (prior.length) {
      if (prior.length !== heroIds.length || prior.some(row => !heroIds.includes(row.heroId))) throw fail("This request key belongs to a different retirement", 409);
      return;
    }
    const heroes = await tx.hero.findMany({ where: { userId, id: { in: heroIds } } });
    if (heroes.length !== heroIds.length) throw fail("One or more heroes are no longer available", 409);
    if (heroes.some(hero => hero.active || hero.status !== "IDLE")) throw fail("Only inactive, resting heroes can retire");
    if (new Set(heroes.map(hero => hero.rarity)).size !== 1) throw fail("Retire one rarity at a time");
    if (await tx.gearPiece.count({ where: { heroId: { in: heroIds } } })) throw fail("Remove all gear before retiring these heroes");
    const season = seasonInfo();
    await tx.hero.deleteMany({ where: { userId, id: { in: heroIds }, active: false, status: "IDLE" } });
    await tx.hallRetirement.createMany({ data: heroes.map(hero => ({ userId, heroId: hero.id, requestKey, season: season.season, rarity: hero.rarity, glory: BASE_GLORY[hero.rarity] * season.multiplier })) });
  }, { timeout: 15_000 });
  return hallState(userId);
}

async function grantHero(tx: Prisma.TransactionClient, userId: string, rarity: HeroRarity) {
  const config = await getConfig();
  if (await tx.hero.count({ where: { userId } }) >= config.economy.MAX_ACTIVE) throw fail("Hero roster is full");
  const heroClass: HeroClass = ["WARRIOR", "MAGE", "ROGUE"][randomInt(3)] as HeroClass;
  await tx.hero.create({ data: { userId, class: heroClass, rarity, active: false, shield: shieldCapacity(rarity), shieldMax: shieldCapacity(rarity), skills: rollHeroSkills(rarity), ...heroStats(heroClass, rarity, config) } });
}

async function grantReward(tx: Prisma.TransactionClient, userId: string, milestone: number) {
  const prize = MILESTONES.find(item => item.points === milestone);
  const reward = prize ?? (milestone >= 14000 && milestone % 2000 === 0 ? { points: milestone, label: "Summon + 40 Scrap", cards: 1, scrap: 40 } : null);
  if (!reward) throw fail("Unknown Glory Road milestone");
  if ("cards" in reward || "scrap" in reward) await tx.user.update({ where: { id: userId }, data: {
    mintCards: { increment: "cards" in reward ? reward.cards : 0 }, scrap: { increment: "scrap" in reward ? reward.scrap : 0 },
  } });
  if ("box" in reward) {
    const rarity = chooseGearRarity(reward.box, randomInt(gearRarityDrawSize(reward.box)));
    const rules = GEAR_RULES[rarity];
    if (await tx.gearPiece.count({ where: { userId } }) >= 500) throw fail("Armory is full");
    await tx.gearPiece.create({ data: { userId, rarity, slot: GEAR_SLOTS[randomInt(GEAR_SLOTS.length)], element: GEAR_ELEMENTS[randomInt(GEAR_ELEMENTS.length)], attack: randomInt(rules.attack[0], rules.attack[1] + 1), shield: rules.shield, shieldMax: rules.shield } });
  }
  if ("hero" in reward) await grantHero(tx, userId, reward.hero);
}

export async function claimHallMilestone(userId: string, milestone: number) {
  if (!Number.isSafeInteger(milestone) || milestone < 100) throw fail("Choose a valid milestone");
  const season = seasonInfo();
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const existing = await tx.hallClaim.findUnique({ where: { userId_season_milestone: { userId, season: season.season, milestone } } });
    if (existing) return;
    const retired = await tx.hallRetirement.aggregate({ where: { userId, season: season.season }, _sum: { glory: true } });
    if ((retired._sum.glory ?? 0) < milestone) throw fail("Not enough glory for this prize");
    await grantReward(tx, userId, milestone);
    await tx.hallClaim.create({ data: { userId, season: season.season, milestone } });
  }, { timeout: 15_000 });
  return hallState(userId);
}

export async function claimHallRace(userId: string, threshold: number) {
  const race = RACES.find(item => item.points === threshold);
  if (!race) throw fail("Unknown Hall race prize");
  const season = seasonInfo();
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${season.season}::int, ${threshold}::int)`;
    const existing = await tx.hallRaceClaim.findUnique({ where: { userId_season_threshold: { userId, season: season.season, threshold } } });
    if (existing) return;
    const retired = await tx.hallRetirement.aggregate({ where: { userId, season: season.season }, _sum: { glory: true } });
    if ((retired._sum.glory ?? 0) < threshold) throw fail("Not enough glory for this race prize");
    if (await tx.hallRaceClaim.count({ where: { season: season.season, threshold } }) >= race.seats) throw fail("All seats for this race prize are filled", 409);
    await grantHero(tx, userId, race.rarity);
    await tx.hallRaceClaim.create({ data: { userId, season: season.season, threshold } });
  }, { timeout: 15_000 });
  return hallState(userId);
}
