import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { advanceGearPity, chooseGearRarity, equipmentAttack, gearRarityDrawSize } from "@herobits/shared";
import { prisma } from "../src/lib/prisma.js";
import { buyEquipment, equipEquipment, fuseEquipment, listEquipment, removeEquipment, repairEquipment, salvageEquipment } from "../src/services/equipment.js";

after(() => prisma.$disconnect());
const enabled = { skip: process.env.HEROBITS_TEST_DATABASE !== "1" };

test("three intact matching gear elements grant a ten percent attack bonus", () => {
  const pieces = [10, 20, 30].map((attack) => ({ attack, element: "FIRE" as const, shield: 100 }));
  assert.equal(equipmentAttack(pieces), 66);
  assert.equal(equipmentAttack([{ ...pieces[0], shield: 0 }, pieces[1], pieces[2]]), 50);
  assert.equal(equipmentAttack([pieces[0], { ...pieces[1], element: "FROST" as const }, pieces[2]]), 60);
});

test("gear boxes respect rarity floors and the strongest due guarantee wins", () => {
  assert.equal(gearRarityDrawSize("STEEL"), 10000);
  assert.equal(gearRarityDrawSize("GREEN"), 4000);
  assert.equal(gearRarityDrawSize("BLUE"), 1500);
  assert.equal(chooseGearRarity("STEEL", 5999), "STEEL");
  assert.equal(chooseGearRarity("STEEL", 6000), "GREEN");
  assert.equal(chooseGearRarity("GREEN", 0), "GREEN");
  assert.equal(chooseGearRarity("BLUE", 1499), "MYTHIC");
  assert.throws(() => chooseGearRarity("BLUE", 1500), RangeError);
  assert.deepEqual(advanceGearPity("STEEL", { blue: 14, purple: 49, gold: 149 }), { rarity: "GOLD", pity: { blue: 14, purple: 49, gold: 0 } });
  assert.equal(advanceGearPity("MYTHIC", { blue: 14, purple: 49, gold: 149 }).rarity, "MYTHIC");
});

test("gear boxes charge once, enforce rarity and daily transfers, and keep repair/salvage atomic", enabled, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:equipment-${randomUUID()}`, displayName: "Equipment QA", gold: 1000, scrap: 100 } });
  try {
    const common = await prisma.hero.create({ data: { userId: user.id, class: "WARRIOR", rarity: "COMMON", atk: 8, spd: 1, stamina: 100, maxStamina: 100 } });
    const rare = await prisma.hero.create({ data: { userId: user.id, class: "MAGE", rarity: "RARE", atk: 12, spd: 1, stamina: 100, maxStamina: 100 } });
    const first = await buyEquipment(user.id, "STEEL", "equipment-qa-once");
    assert.ok(first.piece);
    assert.equal(first.user.gold, 850);
    const retry = await buyEquipment(user.id, "STEEL", "equipment-qa-once");
    assert.equal(retry.piece?.id, first.piece.id);
    assert.equal(retry.user.gold, 850);
    const piece = await prisma.gearPiece.create({ data: { userId: user.id, rarity: "STEEL", slot: "HELM", element: "FIRE", attack: 3, shield: 1200, shieldMax: 1200 } });
    await equipEquipment(user.id, piece.id, common.id);
    await assert.rejects(() => equipEquipment(user.id, piece.id, rare.id), /Remove this piece/);
    await removeEquipment(user.id, piece.id);
    await assert.rejects(() => equipEquipment(user.id, piece.id, rare.id), /tomorrow/);
    await equipEquipment(user.id, piece.id, common.id);
    await prisma.gearPiece.update({ where: { id: piece.id }, data: { shield: 100 } });
    const repaired = await repairEquipment(user.id, piece.id);
    assert.equal(repaired.piece.shield, repaired.piece.shieldMax);
    assert.equal(repaired.user.scrap, 99);
    await assert.rejects(() => salvageEquipment(user.id, [piece.id]), /free gear/);
    await removeEquipment(user.id, piece.id);
    const salvaged = await salvageEquipment(user.id, [piece.id]);
    assert.equal(salvaged.gained, 3);
    assert.equal((await listEquipment(user.id)).length, 1);
    assert.equal((await buyEquipment(user.id, "STEEL", "equipment-qa-once")).piece?.id, first.piece.id);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("gear guarantees and idempotency stay durable across purchases", enabled, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:gear-pity-${randomUUID()}`, displayName: "Gear Pity QA", gold: 1000, gearPityBlue: 14, gearPityPurple: 49, gearPityGold: 149 } });
  try {
    const first = await buyEquipment(user.id, "STEEL", "gear-pity-qa-once");
    assert.ok(first.piece && ["GOLD", "MYTHIC"].includes(first.piece.rarity));
    assert.deepEqual(first.user.gearPity, { blue: 14, purple: 49, gold: 0 });
    const retry = await buyEquipment(user.id, "STEEL", "gear-pity-qa-once");
    assert.equal(retry.piece?.id, first.piece?.id);
    assert.deepEqual(retry.user.gearPity, first.user.gearPity);
    assert.equal(retry.user.gold, 850);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});

test("four matching free pieces fuse into one stronger piece and mixed rarities do not burn Scrap", enabled, async () => {
  const user = await prisma.user.create({ data: { wallet: `demo:gear-fusion-${randomUUID()}`, displayName: "Fusion QA", scrap: 50 } });
  try {
    const pieces = await Promise.all(Array.from({ length: 4 }, () => prisma.gearPiece.create({ data: { userId: user.id, rarity: "GREEN", slot: "HELM", element: "FIRE", attack: 7, shield: 2400, shieldMax: 2400 } })));
    const extra = await prisma.gearPiece.create({ data: { userId: user.id, rarity: "STEEL", slot: "BOOTS", element: "FROST", attack: 3, shield: 1200, shieldMax: 1200 } });
    await assert.rejects(() => fuseEquipment(user.id, [pieces[0].id, pieces[1].id, pieces[2].id, extra.id]), /same rarity/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).scrap, 50);
    const fused = await fuseEquipment(user.id, pieces.map((piece) => piece.id));
    assert.equal(fused.piece.rarity, "BLUE");
    assert.equal(fused.piece.element, "FIRE");
    assert.equal(fused.user.scrap, 26);
    assert.equal((await listEquipment(user.id)).length, 2);
    await assert.rejects(() => fuseEquipment(user.id, pieces.map((piece) => piece.id)), /free gear/);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});
