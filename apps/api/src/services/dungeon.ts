import {
  GAME,
  cellBlocked,
  pathBetween,
  type DungeonSnapshot,
  type DungeonCombatEvent,
  type TargetType,
  type LootKind,
  type TargetKind,
  HERO_SKILLS,
  equipmentAttack,
  type HeroSkill,
} from "@herobits/shared";
import type { Hero, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { toGold, toHeroDto } from "../lib/mappers.js";
import { recoverStamina } from "./stamina.js";
import { consumeStamina } from "./stamina-usage.js";
import { canAttackTarget, planHeroHunt } from "./hero-targeting.js";
import { rollWaveLoot } from "./loot-wave.js";
import { getConfig, gameRules, runtimeRules } from "./config.js";

function occupiedKey(x: number, y: number) {
  return `${x},${y}`;
}

function skillsOf(hero: Hero): Set<HeroSkill> {
  return new Set(Array.isArray(hero.skills)
    ? hero.skills.filter((value): value is HeroSkill => typeof value === "string" && HERO_SKILLS.includes(value as HeroSkill))
    : []);
}

export function randomEmptyCell(
  occupied: Set<string>,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 4000; attempt++) {
    const x = Math.floor(Math.random() * GAME.GRID_WIDTH);
    const y = Math.floor(Math.random() * GAME.GRID_HEIGHT);
    if (cellBlocked(x, y)) continue;
    const key = occupiedKey(x, y);
    if (!occupied.has(key)) {
      occupied.add(key);
      return { x, y };
    }
  }
  return null;
}

export async function spawnTargets(runId: string, count?: number, wave = 1) {
  const config=await getConfig();
  const {GAME}=gameRules(config);
  const occupied = new Set<string>();
  const [existing, hunters] = await Promise.all([
    prisma.dungeonTarget.findMany({ where: { runId } }),
    prisma.hero.findMany({ where: { user: { dungeonRuns: { some: { id: runId } } }, status: "HUNTING" } }),
  ]);
  for (const target of existing) occupied.add(occupiedKey(target.x, target.y));
  for (const hero of hunters) if (hero.dungeonX != null && hero.dungeonY != null) occupied.add(occupiedKey(hero.dungeonX, hero.dungeonY));
  const data: {
    runId: string;
    type: TargetType;
    kind: TargetKind;
    reward: number;
    hp: number;
    maxHp: number;
    x: number;
    y: number;
  }[] = [];

  for (const kind of rollWaveLoot(count ?? GAME.TARGET_COUNT, config.crates)) {
    const cell = randomEmptyCell(occupied);
    if (!cell) break;
    const stats = config.crates[kind];
    const type:TargetType=kind==="wooden-crate"||kind==="iron-crate"?"SLIME":"BLOCK";
    data.push({
      runId,
      type,
      kind,
      reward:stats.reward,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      x: cell.x,
      y: cell.y,
    });
  }

  const chestCount = data.length;
  if (wave >= 2) {
    for (let index = 0; index < Math.min(5, 1 + Math.floor(wave / 2)); index++) {
      const cell = randomEmptyCell(occupied);
      if (!cell) break;
      data.push({ runId, type: "MONSTER", kind: "obsidian-beetle", reward: 12, hp: 85 + wave * 12, maxHp: 85 + wave * 12, x: cell.x, y: cell.y });
    }
  }
  if (wave >= 5 && wave % 5 === 0) {
    const cell = randomEmptyCell(occupied);
    if (cell) data.push({ runId, type: "BOSS", kind: "ember-sentinel", reward: 150 + wave * 10,
      hp: 250 + wave * 50, maxHp: 250 + wave * 50, x: cell.x, y: cell.y });
  }

  if (data.length) {
    await prisma.dungeonTarget.createMany({ data });
  }
  return chestCount;
}

export async function getActiveRun(userId: string) {
  return prisma.dungeonRun.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { targets: true },
  });
}

export async function buildSnapshot(userId: string): Promise<DungeonSnapshot | null> {
  const config=await getConfig();const {GAME}=gameRules(config);
  const run = await getActiveRun(userId);
  if (!run) return null;

  const [user, heroes] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.hero.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  const working = heroes.filter((h) => h.status === "HUNTING").length;

  return {
    runId: run.id,
    visual:config.visual,
    wave: run.wave,
    waveTotal: run.waveTotal,
    openedCrates: run.openedCrates,
    combatSequence: run.combatSequence,
    combatEvents: (Array.isArray(run.combatEvents) ? run.combatEvents : []) as unknown as DungeonCombatEvent[],
    status: run.status,
    gold: toGold(user.gold),
    chest: toGold(user.chest),
    working,
    maxWorking: GAME.MAX_WORKING_HEROES,
    heroes: heroes.map(toHeroDto),
    targets: run.targets.map((t) => ({
      id: t.id,
      kind:t.kind as TargetKind,
      type: t.type,
      hp: t.hp,
      maxHp: t.maxHp,
      x: t.x,
      y: t.y,
    })),
    lastTickAt: run.lastTickAt.toISOString(),
  };
}

const processing = new Map<string, Promise<DungeonSnapshot | null>>();

export function processTicks(userId: string): Promise<DungeonSnapshot | null> {
  const pending = processing.get(userId);
  if (pending) return pending;
  const task = advanceDungeon(userId).finally(() => processing.delete(userId));
  processing.set(userId, task);
  return task;
}

async function advanceDungeon(userId: string) {
  const config=await getConfig();const {GAME}=gameRules(config);
  const run = await getActiveRun(userId);
  const now = Date.now();
  if (!run) {
    await recoverStamina(userId, new Date(now));
    return null;
  }

  const offlineCapMs = GAME.OFFLINE_CAP_HOURS * 60 * 60 * 1000;
  const start = Math.max(run.lastTickAt.getTime(), now - offlineCapMs);
  const ticks = Math.max(0, Math.floor((now - start) / GAME.TICK_MS));
  if (ticks <= 0) {
    await recoverStamina(userId, new Date(now));
    return buildSnapshot(userId);
  }

  let goldEarned = 0;
  let openedCrates = 0;
  let wave = run.wave;
  let waveTotal = run.waveTotal;
  let sequence = run.combatSequence;
  const combatEvents = (Array.isArray(run.combatEvents) ? run.combatEvents : []) as unknown as DungeonCombatEvent[];
  const rewardSources: string[] = [];
  const bossDefeats: string[] = [];

  for (let t = 0; t < ticks; t++) {
    const [heroes, currentTargets] = await Promise.all([
      prisma.hero.findMany({
        where: { userId, status: "HUNTING" },
        include: { gearPieces: true },
      }),
      prisma.dungeonTarget.findMany({ where: { runId: run.id } }),
    ]);

    let targets = currentTargets;
    if (targets.length === 0) {
      wave += 1;
      waveTotal = await spawnTargets(run.id, undefined, wave);
      targets = await prisma.dungeonTarget.findMany({ where: { runId: run.id } });
    }
    if (!heroes.length) break;

    // Settle existing resters before any hunter becomes idle at this historical tick.
    // The remaining offline interval will then also restore an exhausted hunter.
    if (heroes.some((hero) => consumeStamina(hero.stamina, hero.staminaUsageUnits, GAME.TICK_MS, config.stamina.usagePerMinute).stamina === 0)) {
      await recoverStamina(userId, new Date(start + (t + 1) * GAME.TICK_MS));
    }

    const occupied = new Set<string>();
    for (const target of targets) {
      occupied.add(occupiedKey(target.x, target.y));
    }
    for (const hero of heroes) {
      if (hero.dungeonX != null && hero.dungeonY != null) {
        occupied.add(occupiedKey(hero.dungeonX, hero.dungeonY));
      }
    }

    const targetById = new Map(targets.map((tg) => [tg.id, tg]));

    for (const hero of heroes) {
      if (hero.dungeonX == null || hero.dungeonY == null) continue;
      if (hero.stamina <= 0) {
        await idleHero(hero);
        occupied.delete(occupiedKey(hero.dungeonX, hero.dungeonY));
        continue;
      }

      if (!targetById.size) continue;
      const skills = skillsOf(hero);
      const range = config.heroes.classes[hero.class].range;
      const plan = planHeroHunt(
        { x: hero.dungeonX, y: hero.dungeonY }, targetById.values(), range, occupied,
      );
      const nearest = plan?.target;
      let x = hero.dungeonX;
      let y = hero.dungeonY;
      if (plan) {
        for (const next of plan.path.slice(0, skills.has("swift") ? Math.ceil(hero.spd * 1.5) : hero.spd)) {
          occupied.delete(occupiedKey(x, y));
          x = next.x;
          y = next.y;
          occupied.add(occupiedKey(x, y));
        }
      }

      const usage = consumeStamina(hero.stamina, hero.staminaUsageUnits, GAME.TICK_MS, config.stamina.usagePerMinute);
      let stamina = usage.stamina;
      let status = hero.status;
      let shield = hero.shield;
      const staminaUsageUnits = usage.staminaUsageUnits;

      if (nearest && canAttackTarget({ x, y }, nearest, range, occupied)) {
        const preciseStrike = skills.has("precision") && Math.random() < 0.2;
        const previousHits = combatEvents.slice(-20).filter((event) => event.heroId === hero.id && event.targetId === nearest.id);
        const fury = skills.has("fury") ? Math.min(previousHits.length, 4) * 0.06 : 0;
        const execute = skills.has("execute") && nearest.hp <= nearest.maxHp / 4 ? 0.5 : 0;
        const monsterBonus = skills.has("enemyDamage") && nearest.type === "MONSTER" ? 0.2 : 0;
        const bossBonus = skills.has("bossDamage") && nearest.type === "BOSS" ? 50 : 0;
        const gearAttack = equipmentAttack(hero.gearPieces);
        const damage = Math.min(nearest.hp, Math.max(1, Math.round((hero.atk + gearAttack) * (1 + fury + execute + monsterBonus + (preciseStrike ? 0.2 : 0)) + bossBonus)));
        const remaining = nearest.hp - damage;
        const destroyed = remaining <= 0;
        const reward = destroyed ? toGold(nearest.reward) : 0;
        combatEvents.push({
          sequence: ++sequence,
          heroId: hero.id,
          heroClass: hero.class,
          targetId: nearest.id,
          targetType: nearest.type,
          kind:nearest.kind as TargetKind,
          fromX: x,
          fromY: y,
          x: nearest.x,
          y: nearest.y,
          damage,
          destroyed,
          reward,
          at: new Date(start + (t + 1) * GAME.TICK_MS).toISOString(),
        });
        // Keep the replay window small, including after long offline hunts.
        if (combatEvents.length > 64) combatEvents.shift();
        if (destroyed) {
          goldEarned += reward;
          if (nearest.type === "SLIME" || nearest.type === "BLOCK") openedCrates += 1;
          rewardSources.push(`${nearest.type}:${reward}`);
          if (nearest.type === "BOSS") bossDefeats.push(nearest.id);
          targetById.delete(nearest.id);
          occupied.delete(occupiedKey(nearest.x, nearest.y));
          await prisma.dungeonTarget.delete({ where: { id: nearest.id } });
        } else {
          nearest.hp = remaining;
          await prisma.dungeonTarget.update({ where: { id: nearest.id }, data: { hp: remaining } });
        }
      }

      if (stamina <= 0 || shield <= 0) {
        stamina = Math.max(0, stamina);
        status = "IDLE";
        occupied.delete(occupiedKey(x, y));
        await prisma.hero.update({
          where: { id: hero.id },
          data: {
            dungeonX: null,
            dungeonY: null,
            stamina,
            shield,
            staminaRecoveryUnits: 0,
            staminaUsageUnits: 0,
            status,
          },
        });
      } else {
        await prisma.hero.update({
          where: { id: hero.id },
          data: { dungeonX: x, dungeonY: y, stamina, shield, staminaRecoveryUnits: 0, staminaUsageUnits, status },
        });
      }
    }

    const survivingHunters = await prisma.hero.findMany({ where: { userId, status: "HUNTING", shield: { gt: 0 } } });
    for (const monster of targetById.values()) {
      if ((monster.type !== "MONSTER" && monster.type !== "BOSS") || !survivingHunters.length) continue;
      let nearestHero = survivingHunters
        .filter((hero) => hero.dungeonX != null && hero.dungeonY != null)
        .sort((a, b) => Math.abs(a.dungeonX! - monster.x) + Math.abs(a.dungeonY! - monster.y)
          - Math.abs(b.dungeonX! - monster.x) - Math.abs(b.dungeonY! - monster.y))[0];
      if (!nearestHero) continue;
      let distance = Math.abs(nearestHero.dungeonX! - monster.x) + Math.abs(nearestHero.dungeonY! - monster.y);
      const bossCanMove = monster.type !== "BOSS" || Math.floor((start + (t + 1) * GAME.TICK_MS) / GAME.TICK_MS) % 2 === 0;
      if (distance > 1 && bossCanMove) {
        const walkable = new Set(occupied);
        walkable.delete(occupiedKey(monster.x, monster.y));
        const nearbyHunters = survivingHunters
          .filter((hero) => hero.dungeonX != null && hero.dungeonY != null)
          .sort((a, b) => Math.abs(a.dungeonX! - monster.x) + Math.abs(a.dungeonY! - monster.y)
            - Math.abs(b.dungeonX! - monster.x) - Math.abs(b.dungeonY! - monster.y))
          .slice(0, 3);
        const routes = nearbyHunters.flatMap((hero) => {
          if (hero.dungeonX == null || hero.dungeonY == null) return [];
          return [[1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([dx, dy]) => {
            const x = hero.dungeonX! + dx, y = hero.dungeonY! + dy;
            if (cellBlocked(x, y) || walkable.has(occupiedKey(x, y))) return [];
            const path = pathBetween(monster.x, monster.y, x, y, walkable);
            return path.length ? [{ hero, path }] : [];
          });
        });
        routes.sort((a, b) => a.path.length - b.path.length);
        const route = routes[0];
        if (route) {
          const next = route.path[0];
          occupied.delete(occupiedKey(monster.x, monster.y));
          occupied.add(occupiedKey(next.x, next.y));
          monster.x = next.x; monster.y = next.y;
          await prisma.dungeonTarget.update({ where: { id: monster.id }, data: { x: next.x, y: next.y } });
          nearestHero = route.hero;
          distance = Math.abs(nearestHero.dungeonX! - monster.x) + Math.abs(nearestHero.dungeonY! - monster.y);
        }
      }
      if (distance > 1 || nearestHero.shield <= 0) continue;
      const impact = monster.type === "BOSS" ? 5 : 2;
      const shield = Math.max(0, nearestHero.shield - impact);
      const worn = await prisma.gearPiece.findMany({ where: { heroId: nearestHero.id, shield: { gt: 0 } } });
      for (const piece of worn) {
        await prisma.gearPiece.update({ where: { id: piece.id }, data: { shield: Math.max(0, piece.shield - impact * 50) } });
      }
      const defeated = shield === 0;
      combatEvents.push({ sequence: ++sequence, attacker: "MONSTER", heroId: nearestHero.id, heroClass: nearestHero.class,
        targetId: monster.id, targetType: monster.type, kind: monster.type === "BOSS" ? "ember-sentinel" : "obsidian-beetle",
        fromX: monster.x, fromY: monster.y, x: nearestHero.dungeonX!, y: nearestHero.dungeonY!,
        damage: impact, destroyed: false, reward: 0, at: new Date(start + (t + 1) * GAME.TICK_MS).toISOString() });
      if (combatEvents.length > 64) combatEvents.shift();
      await prisma.hero.update({ where: { id: nearestHero.id }, data: {
        shield, ...(defeated ? { status: "IDLE", dungeonX: null, dungeonY: null, staminaUsageUnits: 0, staminaRecoveryUnits: 0 } : {}),
      } });
      nearestHero.shield = shield;
      if (defeated) {
        occupied.delete(occupiedKey(nearestHero.dungeonX!, nearestHero.dungeonY!));
        nearestHero.dungeonX = null; nearestHero.dungeonY = null;
      }
    }
  }

  const lastTickAt = new Date(
    start + ticks * GAME.TICK_MS,
  );

  await prisma.dungeonRun.update({
    where: { id: run.id },
    data: { lastTickAt, wave, waveTotal, openedCrates: { increment: openedCrates }, combatSequence: sequence, combatEvents: combatEvents as unknown as Prisma.InputJsonValue },
  });

  if (goldEarned > 0 || bossDefeats.length) {
    await prisma.$transaction(async tx => {
      if (goldEarned > 0) {
        await tx.user.update({ where: { id: userId }, data: { chest: { increment: goldEarned } } });
        await tx.rewardLog.create({ data: { userId, amount: goldEarned, source: `hunt:${rewardSources.slice(0, 20).join(",")}` } });
      }
      if (bossDefeats.length) await tx.playerMail.createMany({ data: bossDefeats.map(id => ({
        userId, sourceKey: `boss:${id}`, title: "The Sentinel has fallen",
        body: "Your party defeated an Ember Sentinel. Open this hero card as a reward for the hunt.", mintCards: 1,
      })), skipDuplicates: true });
    });
  }

  await recoverStamina(userId, new Date(now));
  return buildSnapshot(userId);
}

async function idleHero(hero: Hero) {
  await prisma.hero.update({
    where: { id: hero.id },
    data: {
      status: "IDLE",
      dungeonX: null,
      dungeonY: null,
      stamina: 0,
      staminaRecoveryUnits: 0,
      staminaUsageUnits: 0,
    },
  });
}

export async function startDungeon(userId: string) {
  await processTicks(userId);
  const existing = await getActiveRun(userId);
  if (existing) {
    const stale = existing.targets.some((t) => cellBlocked(t.x, t.y));
    if (!stale) {
      return buildSnapshot(userId);
    }
    await prisma.dungeonRun.update({
      where: { id: existing.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
  }

  await prisma.hero.updateMany({
    where: { userId, status: "HUNTING" },
    data: { status: "IDLE", dungeonX: null, dungeonY: null },
  });

  const run = await prisma.dungeonRun.create({
    data: { userId },
  });
  const waveTotal = await spawnTargets(run.id);
  await prisma.dungeonRun.update({ where: { id: run.id }, data: { waveTotal } });
  return buildSnapshot(userId);
}

export async function deployHero(userId: string, heroId: string) {
  const {GAME}=await runtimeRules();
  await processTicks(userId);

  const run = await getActiveRun(userId);
  if (!run) {
    throw Object.assign(new Error("No active dungeon"), { statusCode: 400 });
  }

  const working = await prisma.hero.count({
    where: { userId, status: "HUNTING" },
  });
  if (working >= GAME.MAX_WORKING_HEROES) {
    throw Object.assign(new Error("Max working heroes reached"), {
      statusCode: 400,
    });
  }

  const hero = await prisma.hero.findFirst({
    where: { id: heroId, userId },
  });
  if (!hero) {
    throw Object.assign(new Error("Hero not found"), { statusCode: 404 });
  }
  if (hero.status === "LISTED") {
    throw Object.assign(new Error("This hero is listed on the market"), { statusCode: 400 });
  }
  if (hero.status === "HUNTING") {
    throw Object.assign(new Error("Hero already hunting"), { statusCode: 400 });
  }
  if (hero.stamina <= 0) {
    throw Object.assign(new Error("Hero has no stamina"), { statusCode: 400 });
  }
  if (hero.shield <= 0) {
    throw Object.assign(new Error("Repair this hero's shield before hunting"), { statusCode: 400 });
  }

  const occupied = new Set<string>();
  for (const t of run.targets) occupied.add(occupiedKey(t.x, t.y));
  const hunters = await prisma.hero.findMany({
    where: { userId, status: "HUNTING" },
  });
  for (const h of hunters) {
    if (h.dungeonX != null && h.dungeonY != null) {
      occupied.add(occupiedKey(h.dungeonX, h.dungeonY));
    }
  }

  const cell = randomEmptyCell(occupied);
  if (!cell) {
    throw Object.assign(new Error("No free cell"), { statusCode: 400 });
  }

  await prisma.hero.update({
    where: { id: hero.id },
    data: {
      status: "HUNTING",
      staminaRecoveryUnits: 0,
      dungeonX: cell.x,
      dungeonY: cell.y,
    },
  });

  return buildSnapshot(userId);
}

export async function deployAllIdle(userId: string, mode: "all" | "over-half" = "all") {
  const {GAME}=await runtimeRules();
  await processTicks(userId);
  const run = await getActiveRun(userId);
  if (!run) {
    throw Object.assign(new Error("No active dungeon"), { statusCode: 400 });
  }

  const idle = (await prisma.hero.findMany({
    where: { userId, status: "IDLE", stamina: { gt: 0 }, shield: { gt: 0 } },
  })).filter(hero => mode === "all" || hero.stamina > hero.maxStamina / 2);

  let working = await prisma.hero.count({
    where: { userId, status: "HUNTING" },
  });

  const occupied = new Set<string>();
  for (const t of run.targets) occupied.add(occupiedKey(t.x, t.y));
  const hunters = await prisma.hero.findMany({
    where: { userId, status: "HUNTING" },
  });
  for (const h of hunters) {
    if (h.dungeonX != null && h.dungeonY != null) {
      occupied.add(occupiedKey(h.dungeonX, h.dungeonY));
    }
  }

  for (const hero of idle) {
    if (working >= GAME.MAX_WORKING_HEROES) break;
    const cell = randomEmptyCell(occupied);
    if (!cell) break;
    await prisma.hero.update({
      where: { id: hero.id },
      data: {
        status: "HUNTING",
        staminaRecoveryUnits: 0,
        dungeonX: cell.x,
        dungeonY: cell.y,
      },
    });
    working += 1;
  }

  return buildSnapshot(userId);
}
