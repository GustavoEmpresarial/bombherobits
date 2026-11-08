import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cellBlocked } from "@herobits/shared";
import { prisma } from "../src/lib/prisma.js";
import { processTicks, spawnTargets } from "../src/services/dungeon.js";

after(() => prisma.$disconnect());

test("the second wave spawns original monsters without changing its chest goal", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:monster-wave-${randomUUID()}`, displayName: "Monster wave" } });
  try {
    await prisma.dungeonRun.create({ data: { userId: user.id, wave: 1, waveTotal: 0, lastTickAt: new Date(Date.now() - 1500) } });
    const snapshot = await processTicks(user.id);
    assert.equal(snapshot?.wave, 2);
    assert.equal(snapshot?.waveTotal, 60);
    assert.equal(snapshot?.targets.filter(target => target.type === "MONSTER").length, 2);
    assert(snapshot?.targets.every(target => !cellBlocked(target.x, target.y)));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("every fifth wave brings an Ember Sentinel and Boss Hunter deals its bonus", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:boss-${randomUUID()}`, displayName: "Boss test" } });
  try {
    const run = await prisma.dungeonRun.create({ data: { userId: user.id, wave: 5, waveTotal: 60 } });
    assert.equal(await spawnTargets(run.id, 60, 5), 60);
    assert.equal(await prisma.dungeonTarget.count({ where: { runId: run.id, type: "BOSS" } }), 1);
    await prisma.dungeonTarget.deleteMany({ where: { runId: run.id } });
    await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 10, spd: 1,
      stamina: 100, maxStamina: 100, shield: 10, status: "HUNTING", dungeonX: 3, dungeonY: 1, skills: ["bossDamage"] } });
    const boss = await prisma.dungeonTarget.create({ data: { runId: run.id, type: "BOSS", kind: "ember-sentinel", hp: 200, maxHp: 200, reward: 200, x: 5, y: 1 } });
    await prisma.dungeonRun.update({ where: { id: run.id }, data: { lastTickAt: new Date(Date.now() - 1200) } });
    const snapshot = await processTicks(user.id);
    assert.equal(snapshot?.targets.find(target => target.id === boss.id)?.hp, 140);
    assert(snapshot?.combatEvents.some(event => event.attacker !== "MONSTER" && event.damage === 60 && event.targetType === "BOSS"));
    assert(snapshot?.combatEvents.some(event => event.attacker === "MONSTER" && event.damage === 5));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a beetle attacks shield on contact while Monster Slayer boosts hero damage", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:monster-fight-${randomUUID()}`, displayName: "Monster fight" } });
  try {
    const run = await prisma.dungeonRun.create({ data: { userId: user.id, wave: 2, waveTotal: 60, lastTickAt: new Date(Date.now() - 1500) } });
    const hero = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 10, spd: 1,
      stamina: 100, maxStamina: 100, shield: 10, status: "HUNTING", dungeonX: 3, dungeonY: 1, skills: ["enemyDamage"] } });
    const monster = await prisma.dungeonTarget.create({ data: { runId: run.id, type: "MONSTER", kind: "obsidian-beetle", hp: 100, maxHp: 100, reward: 12, x: 5, y: 1 } });
    const snapshot = await processTicks(user.id);
    assert.equal(snapshot?.targets.find(target => target.id === monster.id)?.hp, 88);
    assert.equal(snapshot?.heroes.find(row => row.id === hero.id)?.shield, 8);
    assert(snapshot?.combatEvents.some(event => event.attacker === "MONSTER" && event.heroId === hero.id));
    assert(snapshot?.combatEvents.some(event => event.attacker !== "MONSTER" && event.damage === 12));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a beetle walks toward a hunter without stepping onto pillars or heroes", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:monster-walk-${randomUUID()}`, displayName: "Monster walk" } });
  try {
    const run = await prisma.dungeonRun.create({ data: { userId: user.id, wave: 2, waveTotal: 60, lastTickAt: new Date(Date.now() - 1200) } });
    await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8, spd: 1,
      stamina: 100, maxStamina: 100, shield: 10, status: "HUNTING", dungeonX: 3, dungeonY: 1 } });
    const monster = await prisma.dungeonTarget.create({ data: { runId: run.id, type: "MONSTER", kind: "obsidian-beetle", hp: 100, maxHp: 100, reward: 12, x: 8, y: 1 } });
    const snapshot = await processTicks(user.id);
    const moved = snapshot?.targets.find(target => target.id === monster.id);
    assert.equal(moved?.x, 7);
    assert.equal(moved?.y, 1);
    assert.equal(cellBlocked(moved!.x, moved!.y), false);
    assert(snapshot?.heroes.every(hero => hero.dungeonX !== moved?.x || hero.dungeonY !== moved?.y));
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
