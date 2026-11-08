import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { deployAllIdle, startDungeon } from "../src/services/dungeon.js";

after(() => prisma.$disconnect());

test("bulk work above 50% excludes half-rested heroes and regular work still includes them", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:work-mode-${randomUUID()}`, displayName: "Work mode" } });
  try {
    const above = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 10, spd: 1, stamina: 51, maxStamina: 100 } });
    const half = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 10, spd: 1, stamina: 50, maxStamina: 100 } });
    const below = await prisma.hero.create({ data: { userId: user.id, class: "ROGUE", rarity: "COMMON", atk: 10, spd: 1, stamina: 20, maxStamina: 100 } });
    await startDungeon(user.id);
    await deployAllIdle(user.id, "over-half");
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: above.id } })).status, "HUNTING");
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: half.id } })).status, "IDLE");
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: below.id } })).status, "IDLE");
    await deployAllIdle(user.id, "all");
    assert.equal(await prisma.hero.count({ where: { userId: user.id, status: "HUNTING" } }), 3);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
