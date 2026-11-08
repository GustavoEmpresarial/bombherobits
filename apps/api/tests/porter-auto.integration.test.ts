import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cellBlocked } from "@herobits/shared";
import { prisma } from "../src/lib/prisma.js";
import { runPorter } from "../src/services/porter-auto.js";
import { setShieldRepair, setShieldRepairRarity } from "../src/services/world.js";

after(() => prisma.$disconnect());
const options = { skip: process.env.HEROBITS_TEST_DATABASE !== "1" };

test("porter deploys only healthy resting heroes with at least 80% energy", options, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:porter-auto-${randomUUID()}`, displayName: "Porter auto", porterOn: true } });
  try {
    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.dungeonRun.create({ data: { userId: user.id } });
    const eligible = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 10, spd: 1, stamina: 80, maxStamina: 100 } });
    const tired = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 20, spd: 1, stamina: 79, maxStamina: 100 } });
    const broken = await prisma.hero.create({ data: { userId: user.id, class: "ROGUE", rarity: "COMMON", atk: 30, spd: 2, stamina: 100, maxStamina: 100, shield: 0 } });
    assert.equal(await runPorter(user.id), true);
    const rows = await prisma.hero.findMany({ where: { userId: user.id } });
    assert.equal(rows.find(row => row.id === eligible.id)?.status, "HUNTING");
    const placed = rows.find(row => row.id === eligible.id)!;
    assert.equal(cellBlocked(placed.dungeonX!, placed.dungeonY!), false);
    assert.equal(rows.find(row => row.id === tired.id)?.status, "IDLE");
    assert.equal(rows.find(row => row.id === broken.id)?.status, "IDLE");
    assert.equal(await runPorter(user.id), false);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("a stronger rested hero replaces the weakest worker when the arena is full", options, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:porter-swap-${randomUUID()}`, displayName: "Porter swap", porterOn: true } });
  try {
    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.dungeonRun.create({ data: { userId: user.id } });
    const workers = await Promise.all(Array.from({ length: 15 }, (_, index) => prisma.hero.create({ data: {
      userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 10 + index, spd: 1,
      stamina: 70, maxStamina: 100, status: "HUNTING", dungeonX: 1 + index * 2, dungeonY: 1,
    } })));
    const stronger = await prisma.hero.create({ data: { userId: user.id, class: "ROGUE", rarity: "RARE", atk: 30, spd: 2, stamina: 100, maxStamina: 100 } });
    assert.equal(await runPorter(user.id), true);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: workers[0].id } })).status, "IDLE");
    const incoming = await prisma.hero.findUniqueOrThrow({ where: { id: stronger.id } });
    assert.equal(incoming.status, "HUNTING");
    assert.equal(cellBlocked(incoming.dungeonX!, incoming.dungeonY!), false);
    assert.equal(await prisma.hero.count({ where: { userId: user.id, status: "HUNTING" } }), 15);
    assert.equal(await runPorter(user.id), false);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("porter replaces a common worker with a rarer hero even when its attack is lower", options, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:porter-rarity-${randomUUID()}`, displayName: "Porter rarity", porterOn: true } });
  try {
    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.dungeonRun.create({ data: { userId: user.id } });
    const workers = await Promise.all(Array.from({ length: 15 }, (_, index) => prisma.hero.create({ data: {
      userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 30 + index, spd: 3,
      stamina: 70, maxStamina: 100, status: "HUNTING", dungeonX: 1 + index * 2, dungeonY: 1,
    } })));
    const rarer = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "RARE", atk: 5, spd: 1, stamina: 100, maxStamina: 100 } });
    assert.equal(await runPorter(user.id), true);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: rarer.id } })).status, "HUNTING");
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: workers[0].id } })).status, "IDLE");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("switching the porter off leaves the party unchanged", options, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:porter-off-${randomUUID()}`, displayName: "Porter off", porterOn: false } });
  try {
    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.dungeonRun.create({ data: { userId: user.id } });
    const hero = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 12, spd: 1, stamina: 100, maxStamina: 100 } });
    assert.equal(await runPorter(user.id), false);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } })).status, "IDLE");
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("porter repairs only selected broken shields, strongest first, without spending Scrap twice", options, async () => {
  const user = await prisma.user.create({ data: {
    wallet: `demo:porter-shield-${randomUUID()}`, displayName: "Porter shield",
    porterOn: true, shieldRepairOn: true, shieldRepairRarities: ["COMMON"], scrap: 5,
  } });
  try {
    await prisma.porter.create({ data: { userId: user.id } });
    await prisma.dungeonRun.create({ data: { userId: user.id } });
    const strong = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 20, spd: 2, stamina: 0, maxStamina: 100, shield: 0 } });
    const weak = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 10, spd: 1, stamina: 0, maxStamina: 100, shield: 0 } });
    const excluded = await prisma.hero.create({ data: { userId: user.id, class: "ROGUE", rarity: "RARE", atk: 30, spd: 2, stamina: 0, maxStamina: 100, shield: 0, shieldMax: 18000 } });
    assert.equal(await runPorter(user.id), true);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: strong.id } })).shield, 6000);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: weak.id } })).shield, 0);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: excluded.id } })).shield, 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).scrap, 0);
    assert.equal(await runPorter(user.id), false);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).scrap, 0);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("shield repair preferences require a porter and can exclude every rarity", options, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:porter-pref-${randomUUID()}`, displayName: "Porter prefs" } });
  try {
    await assert.rejects(() => setShieldRepair(user.id, true), /no porter/);
    await prisma.porter.create({ data: { userId: user.id } });
    const enabled = await setShieldRepair(user.id, true);
    assert.equal(enabled.shieldRepairOn, true);
    for (const rarity of enabled.shieldRepairRarities) await setShieldRepairRarity(user.id, rarity, false);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.deepEqual(stored.shieldRepairRarities, []);
    const selected = await setShieldRepairRarity(user.id, "RARE", true);
    assert.deepEqual(selected.shieldRepairRarities, ["RARE"]);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
