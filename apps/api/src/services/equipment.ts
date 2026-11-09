import { randomInt } from "node:crypto";
import type { GearPiece, Prisma } from "@prisma/client";
import { GEAR_BOXES, GEAR_ELEMENTS, GEAR_RARITIES, GEAR_RULES, GEAR_SLOTS, HERO_RARITIES, advanceGearPity, chooseGearRarity, gearRarityDrawSize, type GearBox, type GearPieceDto } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toUserDto } from "../lib/mappers.js";
import { processTicks } from "./dungeon.js";

const fail = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
const dto = (gear: GearPiece): GearPieceDto => ({
  id: gear.id, heroId: gear.heroId, slot: gear.slot, element: gear.element,
  rarity: gear.rarity, attack: gear.attack, shield: gear.shield, shieldMax: gear.shieldMax,
  lastHeroId: gear.lastHeroId, movedDay: gear.movedDay?.toISOString().slice(0, 10) ?? null,
});
const roll = <T>(values: readonly T[]) => values[randomInt(values.length)];

async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  return tx.user.findUniqueOrThrow({ where: { id: userId } });
}

export async function listEquipment(userId: string) {
  const pieces = await prisma.gearPiece.findMany({ where: { userId, listed: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return pieces.map(dto);
}

export async function buyEquipmentBatch(userId: string, box: GearBox, count: number, source: "gold" | "chest", requestKey: string) {
  if (!GEAR_BOXES.includes(box) || ![1, 5, 10, 15].includes(count) || !["gold", "chest"].includes(source) || typeof requestKey !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestKey)) throw fail("Choose a gear box, quantity, balance and valid request key");
  return prisma.$transaction(async (tx) => {
    const buyer = await lockUser(tx, userId);
    const priorBatch = await tx.gearBoxBatch.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
    if (priorBatch) {
      if (priorBatch.box !== box || priorBatch.count !== count || priorBatch.source !== source) throw fail("This request key belongs to a different gear purchase", 409);
      const pieces = priorBatch.results as unknown as GearPieceDto[];
      return { piece: pieces[0] ?? null, pieces, user: toUserDto(buyer), repeated: true, totalCost: priorBatch.totalCost, source };
    }
    const previous = await tx.gearPurchase.findUnique({ where: { userId_requestKey: { userId, requestKey } }, include: { piece: true } });
    if (previous) {
      if (count !== 1 || source !== "gold") throw fail("This request key belongs to a different gear purchase", 409);
      const piece = previous.piece ? dto(previous.piece) : null;
      return { piece, pieces: piece ? [piece] : [], user: toUserDto(buyer), repeated: true, totalCost: previous.cost, source };
    }
    if (await tx.gearPiece.count({ where: { userId } }) + count > 500) throw fail("The armory is full (500 pieces)");
    const boxRules = GEAR_RULES[box];
    const totalCost = boxRules.price * count;
    const paid = await tx.user.updateMany({ where: { id: userId, [source]: { gte: totalCost } }, data: { [source]: { decrement: totalCost } } });
    if (!paid.count) throw fail(`Need ${totalCost} in your ${source === "chest" ? "hunting chest" : "game balance"} for these boxes`);
    let pity = { blue: buyer.gearPityBlue, purple: buyer.gearPityPurple, gold: buyer.gearPityGold };
    const pieces: GearPieceDto[] = [];
    for (let index = 0; index < count; index++) {
      const rolled = chooseGearRarity(box, randomInt(gearRarityDrawSize(box)));
      const result = box === "STEEL" ? advanceGearPity(rolled, pity) : { rarity: rolled, pity };
      pity = result.pity;
      const rules = GEAR_RULES[result.rarity];
      const piece = await tx.gearPiece.create({ data: {
        userId, rarity: result.rarity, slot: roll(GEAR_SLOTS), element: roll(GEAR_ELEMENTS),
        attack: randomInt(rules.attack[0], rules.attack[1] + 1), shield: rules.shield, shieldMax: rules.shield,
      } });
      pieces.push(dto(piece));
    }
    if (box === "STEEL") await tx.user.update({ where: { id: userId }, data: { gearPityBlue: pity.blue, gearPityPurple: pity.purple, gearPityGold: pity.gold } });
    await tx.gearBoxBatch.create({ data: { userId, requestKey, box, count, source, totalCost, results: pieces as unknown as Prisma.InputJsonValue } });
    return { piece: pieces[0] ?? null, pieces, user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })), repeated: false, totalCost, source };
  }, { timeout: 15000 });
}

export async function buyEquipment(userId: string, box: GearBox, requestKey: string) {
  return buyEquipmentBatch(userId, box, 1, "gold", requestKey);
}

export async function equipEquipment(userId: string, pieceId: string, heroId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const [piece, hero] = await Promise.all([
      tx.gearPiece.findFirst({ where: { id: pieceId, userId } }),
      tx.hero.findFirst({ where: { id: heroId, userId } }),
    ]);
    if (!piece || !hero) throw fail("Gear or hero not found", 404);
    if (piece.listed) throw fail("Cancel this gear listing before equipping it");
    if (hero.status !== "IDLE") throw fail("Rest the hero before changing gear");
    if (piece.heroId && piece.heroId !== heroId) throw fail("Remove this piece from its current hero first");
    if (piece.heroId === heroId) return dto(piece);
    const heroRank = HERO_RARITIES.indexOf(hero.rarity);
    const gearRank = GEAR_RARITIES.indexOf(piece.rarity);
    if (gearRank > heroRank || gearRank < heroRank - 2) throw fail("This hero can wear gear of its rarity or up to two rarities below");
    if (piece.shield <= 0) throw fail("Repair this piece before equipping it");
    if (piece.lastHeroId && piece.lastHeroId !== heroId && piece.movedDay?.getTime() === today().getTime()) throw fail("This piece can move to another hero tomorrow");
    if (await tx.gearPiece.findFirst({ where: { userId, heroId, slot: piece.slot } })) throw fail(`This hero already wears ${piece.slot.toLowerCase()} gear`);
    return dto(await tx.gearPiece.update({ where: { id: pieceId }, data: { heroId } }));
  });
}

export async function removeEquipment(userId: string, pieceId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const piece = await tx.gearPiece.findFirst({ where: { id: pieceId, userId }, include: { hero: true } });
    if (!piece) throw fail("Gear not found", 404);
    if (piece.listed) throw fail("Cancel this gear listing before removing it");
    if (!piece.heroId) return dto(piece);
    if (piece.hero?.status !== "IDLE") throw fail("Rest the hero before removing gear");
    return dto(await tx.gearPiece.update({ where: { id: pieceId }, data: { heroId: null, lastHeroId: piece.heroId, movedDay: today() } }));
  });
}

export async function repairEquipment(userId: string, pieceId: string) {
  await processTicks(userId);
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const piece = await tx.gearPiece.findFirst({ where: { id: pieceId, userId }, include: { hero: true } });
    if (!piece) throw fail("Gear not found", 404);
    if (piece.listed) throw fail("Cancel this gear listing before repairing it");
    if (piece.hero && piece.hero.status !== "IDLE") throw fail("Rest the hero before repairing gear");
    if (piece.shield >= piece.shieldMax) throw fail("Gear shield is already full");
    const cost = GEAR_RULES[piece.rarity].repair;
    if (!(await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } })).count) throw fail(`Need ${cost} Scrap to repair this piece`);
    const updated = await tx.gearPiece.update({ where: { id: pieceId }, data: { shield: piece.shieldMax } });
    return { piece: dto(updated), cost, user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })) };
  });
}

export async function salvageEquipment(userId: string, pieceIds: string[]) {
  if (!Array.isArray(pieceIds) || pieceIds.some((id) => typeof id !== "string" || !id)) throw fail("Choose valid gear pieces");
  const ids = [...new Set(pieceIds)];
  if (!ids.length || ids.length > 20 || ids.length !== pieceIds.length) throw fail("Choose 1 to 20 different pieces");
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const pieces = await tx.gearPiece.findMany({ where: { userId, id: { in: ids } } });
    if (pieces.length !== ids.length || pieces.some((piece) => piece.heroId || piece.listed)) throw fail("Only owned, free gear can be salvaged");
    const gained = pieces.reduce((sum, piece) => sum + GEAR_RULES[piece.rarity].salvage, 0);
    await tx.gearPiece.deleteMany({ where: { userId, id: { in: ids }, heroId: null, listed: false } });
    const user = await tx.user.update({ where: { id: userId }, data: { scrap: { increment: gained } } });
    return { gained, user: toUserDto(user) };
  });
}

export async function fuseEquipment(userId: string, pieceIds: string[]) {
  if (!Array.isArray(pieceIds) || pieceIds.some((id) => typeof id !== "string" || !id)) throw fail("Choose valid gear pieces");
  const ids = [...new Set(pieceIds)];
  if (ids.length !== 4 || pieceIds.length !== 4) throw fail("Choose four different pieces");
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const pieces = await tx.gearPiece.findMany({ where: { userId, id: { in: ids } } });
    if (pieces.length !== 4 || pieces.some((piece) => piece.heroId || piece.listed)) throw fail("Only owned, free gear can be fused");
    const rarity = pieces[0].rarity;
    if (pieces.some((piece) => piece.rarity !== rarity)) throw fail("All four pieces must have the same rarity");
    const next = GEAR_RARITIES[GEAR_RARITIES.indexOf(rarity) + 1];
    if (!next) throw fail("Mythic gear is the highest rarity");
    const cost = GEAR_RULES[rarity].fusion;
    if (!(await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } })).count) throw fail(`Need ${cost} Scrap to fuse gear`);
    const element = pieces.every((piece) => piece.element === pieces[0].element) ? pieces[0].element : roll(GEAR_ELEMENTS);
    const rules = GEAR_RULES[next];
    await tx.gearPiece.deleteMany({ where: { userId, id: { in: ids }, heroId: null, listed: false } });
    const piece = await tx.gearPiece.create({ data: { userId, rarity: next, slot: roll(GEAR_SLOTS), element,
      attack: randomInt(rules.attack[0], rules.attack[1] + 1), shield: rules.shield, shieldMax: rules.shield } });
    return { piece: dto(piece), cost, user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })) };
  });
}
