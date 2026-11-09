import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { claimHallMilestone, claimHallRace, hallState, retireHeroes } from "../src/services/hall.js";
import { deployHero, startDungeon } from "../src/services/dungeon.js";

after(() => prisma.$disconnect());

test("inactive hero retirement earns seasonal Glory once and a milestone is claimed once", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:hall-${randomUUID()}`, displayName: "Hall tester" } });
  try {
    const active = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100 } });
    const inactive = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 12, spd: 1, stamina: 100, maxStamina: 100, active: false } });
    await startDungeon(user.id);
    await assert.rejects(() => deployHero(user.id, inactive.id), /Activate this hero/);
    await assert.rejects(() => retireHeroes(user.id, [active.id], randomUUID()), /Only inactive/);
    const requestKey = randomUUID();
    const first = await retireHeroes(user.id, [inactive.id], requestKey);
    assert.equal(first.glory, first.gloryByRarity.COMMON);
    assert.equal(first.retired, 1);
    assert.equal(await prisma.hero.count({ where: { id: inactive.id } }), 0);
    const repeated = await retireHeroes(user.id, [inactive.id], requestKey);
    assert.equal(repeated.glory, first.glory);
    await assert.rejects(() => retireHeroes(user.id, [active.id], requestKey), /different retirement/);
    await assert.rejects(() => claimHallMilestone(user.id, 2000), /Not enough glory/);
    await claimHallMilestone(user.id, 100);
    await claimHallMilestone(user.id, 100);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).scrap, 40);
    assert.equal((await hallState(user.id)).milestones.find(item => item.points === 100)?.claimed, true);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("first-to-reach race seat grants one hero and is idempotent", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:hall-race-${randomUUID()}`, displayName: "Race tester" } });
  try {
    const season = (await hallState(user.id)).season;
    await prisma.hallRetirement.create({ data: { userId: user.id, heroId: randomUUID(), requestKey: randomUUID(), season, rarity: "EPIC", glory: 3000 } });
    const first = await claimHallRace(user.id, 3000);
    assert.equal(first.races.find(race => race.points === 3000)?.claimed, true);
    assert.equal(first.races.find(race => race.points === 3000)?.left, 49);
    await claimHallRace(user.id, 3000);
    assert.equal(await prisma.hero.count({ where: { userId: user.id, rarity: "EPIC" } }), 1);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
