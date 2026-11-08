import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { summonRanking } from "../src/services/ranking.js";

after(() => prisma.$disconnect());

test("seven-day summon board weights rarities and keeps demo separate", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const users = await Promise.all([
    prisma.user.create({ data: { wallet: `demo:rank-a-${randomUUID()}`, displayName: "Scout" } }),
    prisma.user.create({ data: { wallet: `demo:rank-b-${randomUUID()}`, displayName: "Champion" } }),
    prisma.user.create({ data: { wallet: `rank-live-${randomUUID()}`, displayName: "Live" } }),
  ]);
  const now = new Date("2026-11-07T12:00:00.000Z");
  const card = (rarity: string) => ({ class: "WARRIOR", rarity, atk: 8, spd: 1, maxStamina: 100 });
  const batch = (userId: string, rarities: string[], createdAt = now) => prisma.summonBatch.create({ data: {
    userId, source: "GOLD", status: "CLAIMED", count: rarities.length, cost: 0,
    requestKey: randomUUID(), rolls: rarities.map(card), createdAt,
  } });
  try {
    await Promise.all([
      batch(users[0].id, ["COMMON", "RARE"]),
      batch(users[1].id, ["EPIC"]),
      batch(users[2].id, ["SUPER_LEGENDARY"]),
      batch(users[0].id, ["SUPER_LEGENDARY"], new Date("2026-10-30T12:00:00.000Z")),
    ]);
    const ranking = await summonRanking(users[0].id, now);
    const champion = ranking.standings.find(row => row.userId === users[1].id);
    assert.equal(champion?.displayName, "Champion");
    assert.equal(champion?.points, 20);
    assert.equal(ranking.me?.points, 4);
    assert.ok(champion && ranking.me && champion.rank < ranking.me.rank);
    assert.equal(ranking.standings.some(row => row.userId === users[2].id), false);
    assert.equal(new Date(ranking.endsAt).getTime() - new Date(ranking.startsAt).getTime(), 7 * 24 * 60 * 60 * 1000);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  }
});
