import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { processTicks } from "../src/services/dungeon.js";
import { claimMail, listMail } from "../src/services/mail.js";

after(() => prisma.$disconnect());

test("defeating a boss mails one hero card and claiming it twice credits once", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:mail-${randomUUID()}`, displayName: "Mail test", mintCards: 0 } });
  try {
    const run = await prisma.dungeonRun.create({ data: { userId: user.id, wave: 5, waveTotal: 60, lastTickAt: new Date(Date.now() - 1200) } });
    await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 200, spd: 1,
      stamina: 100, maxStamina: 100, status: "HUNTING", dungeonX: 3, dungeonY: 1 } });
    await prisma.dungeonTarget.create({ data: { runId: run.id, type: "BOSS", kind: "ember-sentinel", hp: 100, maxHp: 100, reward: 200, x: 5, y: 1 } });
    await processTicks(user.id);
    const inbox = await listMail(user.id);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].mintCards, 1);
    assert.equal(inbox[0].claimedAt, null);
    const first = await claimMail(user.id, inbox[0].id);
    const second = await claimMail(user.id, inbox[0].id);
    assert.equal(first.claimed, true);
    assert.equal(second.claimed, false);
    assert.equal(second.user.mintCards, 1);
    assert.equal((await listMail(user.id))[0].claimedAt !== null, true);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("mail cannot be claimed by a different player", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const owner = await prisma.user.create({ data: { wallet: `demo:mail-owner-${randomUUID()}`, displayName: "Owner" } });
  const stranger = await prisma.user.create({ data: { wallet: `demo:mail-stranger-${randomUUID()}`, displayName: "Stranger" } });
  try {
    const mail = await prisma.playerMail.create({ data: { userId: owner.id, sourceKey: `qa:${randomUUID()}`, title: "Gift", body: "A test delivery", mintCards: 1 } });
    await assert.rejects(() => claimMail(stranger.id, mail.id), /Mail not found/);
    assert.equal((await prisma.playerMail.findUniqueOrThrow({ where: { id: mail.id } })).claimedAt, null);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
  }
});
