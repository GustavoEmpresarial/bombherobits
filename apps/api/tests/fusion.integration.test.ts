import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { fuseHeroes } from "../src/services/fusion.js";

after(() => prisma.$disconnect());

test("fusion consumes exactly four resting heroes and retries are idempotent", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: {
    wallet: `demo:fusion-${randomUUID()}`,
    displayName: "Disposable fusion QA",
    heroes: { create: Array.from({ length: 5 }, () => ({
      class: "WARRIOR" as const, rarity: "COMMON" as const, atk: 8, spd: 1, stamina: 100, maxStamina: 100,
    })) },
  } });
  try {
    const original = await prisma.hero.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const ids = original.slice(0, 4).map((hero) => hero.id);
    const key = randomUUID();
    const result = await fuseHeroes(user.id, ids, key);
    assert.equal(result.sourceRarity, "COMMON");
    assert(["RARE", "SUPER_RARE"].includes(result.resultRarity));
    assert.equal((await prisma.hero.count({ where: { userId: user.id } })), 2);
    assert.equal((await prisma.hero.count({ where: { id: { in: ids } } })), 0);
    assert.equal((await fuseHeroes(user.id, [...ids].reverse(), key)).hero.id, result.hero.id);
    assert.equal((await prisma.hero.count({ where: { userId: user.id } })), 2);
    await assert.rejects(() => fuseHeroes(user.id, [ids[0], ids[0], ids[2], ids[3]], randomUUID()), /different/);
    await assert.rejects(() => fuseHeroes(user.id, [original[4].id, ...ids.slice(1)], randomUUID()), /no longer yours/);
    assert.equal((await prisma.fusion.count({ where: { userId: user.id } })), 1);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
