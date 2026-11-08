import { GAME, RARITY_INFO, cellBlocked, shieldRepairCost } from "@herobits/shared";
import type { Hero } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getConfig } from "./config.js";
import { randomEmptyCell } from "./dungeon.js";

function comparePriority(a: Hero, b: Hero) {
  return RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank
    || b.atk - a.atk || a.id.localeCompare(b.id);
}

function stronger(a: Hero, b: Hero) {
  return RARITY_INFO[a.rarity].rank > RARITY_INFO[b.rarity].rank
    || (a.rarity === b.rarity && a.atk > b.atk);
}

// Called only from an active dungeon WebSocket. The porter never works while
// the player is offline and cannot redeploy a hero before 80% energy.
export async function runPorter(userId: string): Promise<boolean> {
  const config = await getConfig();
  const capacity = config.game.MAX_WORKING_HEROES;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.porterOn || !(await tx.porter.count({ where: { userId } }))) return false;
    const run = await tx.dungeonRun.findFirst({ where: { userId, status: "ACTIVE" } });
    if (!run) return false;

    const [heroes, targets] = await Promise.all([
      tx.hero.findMany({ where: { userId }, orderBy: { id: "asc" } }),
      tx.dungeonTarget.findMany({ where: { runId: run.id }, select: { x: true, y: true } }),
    ]);
    let changed = false;
    if (user.shieldRepairOn) {
      let scrapRemaining = user.scrap;
      const broken = heroes.filter(hero => hero.status === "IDLE" && hero.shield <= 0
        && user.shieldRepairRarities.includes(hero.rarity))
        .sort(comparePriority);
      for (const hero of broken) {
        const cost = shieldRepairCost(hero.rarity, hero.shieldLevel, hero.shield, hero.shieldMax);
        if (!cost || scrapRemaining < cost) continue;
        const paid = await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } });
        if (!paid.count) break;
        await tx.hero.update({ where: { id: hero.id }, data: { shield: hero.shieldMax, shieldRecoveryUnits: 0 } });
        hero.shield = hero.shieldMax;
        scrapRemaining -= cost;
        changed = true;
      }
    }
    const working = heroes.filter(hero => hero.status === "HUNTING" && hero.dungeonX !== null && hero.dungeonY !== null);
    const ready = heroes.filter(hero => hero.status === "IDLE" && hero.shield > 0
      && hero.stamina >= Math.ceil(hero.maxStamina * 0.8))
      .sort(comparePriority);
    if (!ready.length) return changed;
    const occupied = new Set(targets.map(target => `${target.x},${target.y}`));
    for (const hero of working) occupied.add(`${hero.dungeonX},${hero.dungeonY}`);
    for (const candidate of ready) {
      let replaced: Hero | undefined;
      if (working.length >= capacity) {
        replaced = [...working].sort((a, b) => comparePriority(b, a))[0];
        if (!replaced || !stronger(candidate, replaced)) break;
        occupied.delete(`${replaced.dungeonX},${replaced.dungeonY}`);
      }
      const cell = randomEmptyCell(occupied);
      if (!cell || cellBlocked(cell.x, cell.y)) break;
      if (replaced) {
        await tx.hero.update({ where: { id: replaced.id }, data: {
          status: "IDLE", dungeonX: null, dungeonY: null, staminaUsageUnits: 0,
        } });
        working.splice(working.indexOf(replaced), 1);
      }
      const placed = await tx.hero.update({ where: { id: candidate.id }, data: {
        status: "HUNTING", dungeonX: cell.x, dungeonY: cell.y, staminaRecoveryUnits: 0,
      } });
      working.push(placed);
      changed = true;
    }
    return changed;
  }, { timeout: 15_000 });
}
