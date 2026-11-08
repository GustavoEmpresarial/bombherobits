import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { setForgeAssignment, worldState } from "../src/services/world.js";

after(() => prisma.$disconnect());

test("recovery slots can be assigned and excluded without losing automatic fallback", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:forge-${randomUUID()}`, displayName: "Forge QA" } });
  try {
    await prisma.blacksmith.create({ data: { userId: user.id, tier: 1, inService: true } });
    const heroes = [];
    for (let index = 0; index < 5; index++) {
      heroes.push(await prisma.hero.create({ data: {
        userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8 + index, spd: 1,
        stamina: 50, maxStamina: 100,
      } }));
    }
    const initial = await worldState(user.id);
    assert.deepEqual(initial.forgeHeroIds, heroes.slice(0, 4).map(hero => hero.id));
    const afterRemoval = await setForgeAssignment(user.id, heroes[0].id, false);
    assert.equal(afterRemoval.forgeHeroIds.includes(heroes[0].id), false);
    assert.equal(afterRemoval.forgeHeroIds.includes(heroes[4].id), true);
    const afterPin = await setForgeAssignment(user.id, heroes[4].id, true);
    assert.equal(afterPin.forgeHeroIds[0], heroes[4].id);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: heroes[4].id } })).forgeMode, "PINNED");

    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { porterOn: true } });
    await assert.rejects(setForgeAssignment(user.id, heroes[1].id, false), /porter off/);
    const automated = await worldState(user.id);
    assert.equal(automated.forgeHeroIds[0], heroes[4].id);
    assert.equal(automated.forgeHeroIds.length, 4);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
