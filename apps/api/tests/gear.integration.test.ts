import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { scrapHero, repairShield, upgradeShield, buyScrap } from "../src/services/gear.js";
import { deployHero, startDungeon } from "../src/services/dungeon.js";
import { recoverStamina } from "../src/services/stamina.js";

after(() => prisma.$disconnect());

test("Scrap packs charge game gold once and supply a broken hero's repair", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:scrap-pack-${randomUUID()}`, displayName: "Scrap shop test", gold: 100 } });
  try {
    const hero = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100, shield: 200 } });
    await assert.rejects(() => buyScrap(user.id, 11), /available Scrap pack/);
    const bought = await buyScrap(user.id, 10);
    assert.equal(bought.user.gold, 0);
    assert.equal(bought.user.scrap, 10);
    await assert.rejects(() => buyScrap(user.id, 10), /Need 100 gold/);
    const repaired = await repairShield(user.id, hero.id);
    assert.equal(repaired.cost, 5);
    assert.equal(repaired.hero.shield, repaired.hero.shieldMax);
    assert.equal(repaired.user.scrap, 5);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("Scrap can be bought straight from the hunting chest without touching game gold", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:scrap-chest-${randomUUID()}`, displayName: "Chest Scrap test", gold: 25, chest: 100 } });
  try {
    await assert.rejects(() => buyScrap(user.id, 10, "gold"), /Need 100 gold/);
    await assert.rejects(() => buyScrap(user.id, 10, "other" as "gold"), /Choose game gold or hunting chest/);
    const bought = await buyScrap(user.id, 10, "chest");
    assert.equal(bought.user.gold, 25);
    assert.equal(bought.user.chest, 0);
    assert.equal(bought.user.scrap, 10);
    await assert.rejects(() => buyScrap(user.id, 10, "chest"), /Need 100 in the hunting chest/);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("scrap pays once, shield repair uses Scrap, and a broken shield blocks deployment", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:gear-${randomUUID()}`, displayName: "Gear test", gold: 100 } });
  try {
    const broken = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100, shield: 0 } });
    const spare = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100 } });
    await startDungeon(user.id);
    await assert.rejects(() => deployHero(user.id, broken.id), /Repair this hero's shield/);
    await assert.rejects(() => repairShield(user.id, broken.id), /Need 5 Scrap/);
    const salvaged = await scrapHero(user.id, spare.id);
    assert.equal(salvaged.scrapReceived, 30);
    await assert.rejects(() => scrapHero(user.id, spare.id), /Hero not found/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).scrap, 30);
    const repaired = await repairShield(user.id, broken.id);
    assert.equal(repaired.cost, 5);
    assert.equal(repaired.hero.shield, 6000);
    assert.equal(repaired.user.scrap, 25);
    await buyScrap(user.id, 10);
    const upgraded = await upgradeShield(user.id, broken.id);
    assert.equal(upgraded.cost, 30);
    assert.equal(upgraded.hero.shield, 6000);
    assert.equal(upgraded.hero.shieldMax, 12000);
    assert.equal(upgraded.hero.shieldLevel, 2);
    assert.equal(upgraded.user.scrap, 5);
    const deployed = await deployHero(user.id, broken.id);
    assert.equal(deployed.heroes.find((hero) => hero.id === broken.id)?.status, "HUNTING");
    await assert.rejects(() => scrapHero(user.id, broken.id), /Rest and unlist/);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("Quick Repair restores only resting heroes' shields across an offline interval", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:repair-${randomUUID()}`, displayName: "Repair test" } });
  try {
    const skilled = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "RARE", atk: 8, spd: 1, stamina: 100, maxStamina: 100, shield: 10, skills: ["blacksmith"] } });
    const ordinary = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100, shield: 10 } });
    const clock = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).staminaUpdatedAt;
    const base = Math.max(clock.getTime(), skilled.createdAt.getTime(), ordinary.createdAt.getTime());
    await recoverStamina(user.id, new Date(base + 60_000));
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: skilled.id } })).shield, 10);
    await recoverStamina(user.id, new Date(base + 240_000));
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: skilled.id } })).shield, 11);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: ordinary.id } })).shield, 10);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});
