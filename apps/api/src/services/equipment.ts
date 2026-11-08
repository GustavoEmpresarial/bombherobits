import { randomInt } from "node:crypto";
import type { GearPiece, GearRarity, Prisma } from "@prisma/client";
import { GEAR_ELEMENTS, GEAR_RARITIES, GEAR_RULES, GEAR_SLOTS, HERO_RARITIES, type GearPieceDto } from "@herobits/shared";
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
  const pieces = await prisma.gearPiece.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return pieces.map(dto);
}

export async function buyEquipment(userId: string, rarity: GearRarity, requestKey: string) {
  if (!GEAR_RARITIES.includes(rarity) || typeof requestKey !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(requestKey)) throw fail("Choose a gear box and a valid request key");
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const previous = await tx.gearPurchase.findUnique({ where: { userId_requestKey: { userId, requestKey } }, include: { piece: true } });
    if (previous) return { piece: previous.piece ? dto(previous.piece) : null, user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })), repeated: true };
    if (await tx.gearPiece.count({ where: { userId } }) >= 500) throw fail("The armory is full (500 pieces)");
    const rules = GEAR_RULES[rarity];
    const paid = await tx.user.updateMany({ where: { id: userId, gold: { gte: rules.price } }, data: { gold: { decrement: rules.price } } });
    if (!paid.count) throw fail(`Need ${rules.price} game gold for this box`);
    const piece = await tx.gearPiece.create({ data: {
      userId, rarity, slot: roll(GEAR_SLOTS), element: roll(GEAR_ELEMENTS),
      attack: randomInt(rules.attack[0], rules.attack[1] + 1), shield: rules.shield, shieldMax: rules.shield,
    } });
    await tx.gearPurchase.create({ data: { userId, requestKey, pieceId: piece.id, cost: rules.price } });
    return { piece: dto(piece), user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })), repeated: false };
  });
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
    if (pieces.length !== ids.length || pieces.some((piece) => piece.heroId)) throw fail("Only owned, free gear can be salvaged");
    const gained = pieces.reduce((sum, piece) => sum + GEAR_RULES[piece.rarity].salvage, 0);
    await tx.gearPiece.deleteMany({ where: { userId, id: { in: ids }, heroId: null } });
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
    if (pieces.length !== 4 || pieces.some((piece) => piece.heroId)) throw fail("Only owned, free gear can be fused");
    const rarity = pieces[0].rarity;
    if (pieces.some((piece) => piece.rarity !== rarity)) throw fail("All four pieces must have the same rarity");
    const next = GEAR_RARITIES[GEAR_RARITIES.indexOf(rarity) + 1];
    if (!next) throw fail("Gold gear is the highest rarity");
    const cost = GEAR_RULES[rarity].fusion;
    if (!(await tx.user.updateMany({ where: { id: userId, scrap: { gte: cost } }, data: { scrap: { decrement: cost } } })).count) throw fail(`Need ${cost} Scrap to fuse gear`);
    const element = pieces.every((piece) => piece.element === pieces[0].element) ? pieces[0].element : roll(GEAR_ELEMENTS);
    const rules = GEAR_RULES[next];
    await tx.gearPiece.deleteMany({ where: { userId, id: { in: ids }, heroId: null } });
    const piece = await tx.gearPiece.create({ data: { userId, rarity: next, slot: roll(GEAR_SLOTS), element,
      attack: randomInt(rules.attack[0], rules.attack[1] + 1), shield: rules.shield, shieldMax: rules.shield } });
    return { piece: dto(piece), cost, user: toUserDto(await tx.user.findUniqueOrThrow({ where: { id: userId } })) };
  });
}
