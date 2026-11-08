import { randomBytes } from "node:crypto";
import { Prisma, type HeroRarity } from "@prisma/client";
import { type UserDto } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toGold, toUserDto } from "../lib/mappers.js";
import { processTicks } from "./dungeon.js";
import { runtimeRules,getConfig } from "./config.js";
import { selectForgeHeroes } from "./stamina-recovery.js";

export async function ensureProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.inviteCode) return user;
  return prisma.user.update({
    where: { id: userId },
    data: { inviteCode: randomBytes(4).toString("hex") },
  });
}

function fail(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export async function worldState(userId: string) {
  const {ECONOMY,BLACKSMITHS}=await runtimeRules();
  await processTicks(userId);
  const user = await ensureProfile(userId);
  const [blacksmiths, porters, listings, myListings] = await Promise.all([
    prisma.blacksmith.findMany({ where: { userId }, orderBy: { tier: "asc" } }),
    prisma.porter.findMany({ where: { userId } }),
    prisma.listing.findMany({
      where: { status: "OPEN", seller: user.wallet.startsWith("demo:") ? { wallet: { startsWith: "demo:" } } : { NOT: { wallet: { startsWith: "demo:" } } } },
      orderBy: { price: "asc" },
      take: 40,
      include: { seller: { select: { displayName: true, wallet: true } } },
    }),
    prisma.listing.findMany({ where: { sellerId: userId, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const listedHeroIds = [...listings, ...myListings].filter((listing) => listing.kind === "HERO").map((listing) => listing.refId);
  const listedHeroes = listedHeroIds.length ? await prisma.hero.findMany({ where: { id: { in: listedHeroIds } }, select: { id: true, class: true } }) : [];
  const heroClassById = new Map(listedHeroes.map((hero) => [hero.id, hero.class]));
  const service = blacksmiths.find((b) => b.inService);
  const restingHeroes = service ? await prisma.hero.findMany({
    where: { userId, status: "IDLE" },
    select: { id: true, stamina: true, maxStamina: true, staminaRecoveryUnits: true, createdAt: true, forgeMode: true, atk: true, spd: true, rarity: true, shield: true },
  }) : [];
  const serviceSlots = BLACKSMITHS.find(spec => spec.tier === service?.tier)?.slots ?? 0;
  return {
    user: toUserDto(user),
    blacksmiths: blacksmiths.map((b) => ({
      id: b.id,
      tier: b.tier,
      name: BLACKSMITHS[b.tier - 1]?.name ?? `Tier ${b.tier}`,
      inService: b.inService,
    })),
    serviceName: service ? BLACKSMITHS[service.tier - 1]?.name ?? null : null,
    forgeHeroIds: selectForgeHeroes(restingHeroes, serviceSlots, user.porterOn && porters.length > 0).map(hero => hero.id),
    porters: porters.length,
    porterItems: porters.map((porter) => ({ id: porter.id })),
    porterOn: user.porterOn,
    shieldRepairOn: user.shieldRepairOn,
    shieldRepairRarities: user.shieldRepairRarities,
    listings: listings.map((l) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      price: toGold(l.price),
      seller: l.seller.displayName,
      mine: l.sellerId === userId,
      heroClass: l.kind === "HERO" ? heroClassById.get(l.refId) ?? null : null,
    })),
    myListings: myListings.map((l) => ({ id: l.id, kind: l.kind, refId: l.refId, title: l.title, price: toGold(l.price), heroClass: l.kind === "HERO" ? heroClassById.get(l.refId) ?? null : null })),
    catalog: BLACKSMITHS,
    economy: ECONOMY,
  };
}

export async function buyBlacksmith(userId: string, tier: number) {
  const {ECONOMY,BLACKSMITHS}=await runtimeRules();
  await processTicks(userId);
  const spec = BLACKSMITHS.find((b) => b.tier === tier);
  if (!spec) throw fail("Unknown blacksmith");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (toGold(user.gold) < spec.price) throw fail("Not enough gold");
    const owned = await tx.blacksmith.findFirst({ where: { userId, tier } });
    if (owned) throw fail("You already own this tier");
    const highest = await tx.blacksmith.findFirst({
      where: { userId },
      orderBy: { tier: "desc" },
    });
    if ((highest?.tier ?? 0) + 1 < tier) throw fail("Buy the previous tier first");

    const payment = await tx.user.updateMany({
      where: { id: userId, gold: { gte: spec.price } },
      data: { gold: { decrement: spec.price } },
    });
    if (!payment.count) throw fail("Not enough gold");
    await tx.blacksmith.create({ data: { userId, tier, inService: !highest } });
  });
  return worldState(userId);
}

export async function setBlacksmithService(userId: string, id: string) {
  await processTicks(userId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const row = await tx.blacksmith.findFirst({ where: { id, userId } });
    if (!row) throw fail("Blacksmith not found", 404);
    if (await tx.listing.count({ where: { sellerId: userId, kind: "BLACKSMITH", refId: id, status: "OPEN" } })) {
      throw fail("Cancel this house listing before activating it");
    }
    await tx.blacksmith.updateMany({ where: { userId }, data: { inService: false } });
    await tx.blacksmith.update({ where: { id }, data: { inService: true } });
  });
  return worldState(userId);
}

export async function setForgeAssignment(userId: string, heroId: string, assigned: boolean) {
  const { BLACKSMITHS } = await runtimeRules();
  await processTicks(userId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const [user, service, porters, hero] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.blacksmith.findFirst({ where: { userId, inService: true } }),
      tx.porter.count({ where: { userId } }),
      tx.hero.findFirst({ where: { id: heroId, userId } }),
    ]);
    if (!service) throw fail("Activate a recovery house first");
    if (user.porterOn && porters > 0) throw fail("Switch the porter off to choose forge slots by hand");
    if (!hero || hero.status !== "IDLE") throw fail("Only resting heroes can use a forge slot");
    if (assigned && hero.stamina >= hero.maxStamina) throw fail("This hero is already fully rested");
    if (assigned && hero.forgeMode !== "PINNED") {
      const slots = BLACKSMITHS.find(spec => spec.tier === service.tier)?.slots ?? 0;
      const pinned = await tx.hero.findMany({ where: { userId, status: "IDLE", forgeMode: "PINNED" }, select: { stamina: true, maxStamina: true } });
      if (pinned.filter(row => row.stamina < row.maxStamina).length >= slots) throw fail("Every recovery slot is assigned");
    }
    await tx.hero.update({ where: { id: heroId }, data: { forgeMode: assigned ? "PINNED" : "EXCLUDED" } });
  });
  return worldState(userId);
}

export async function buyPorter(userId: string) {
  const {ECONOMY,BLACKSMITHS}=await runtimeRules();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const service = await tx.blacksmith.findFirst({
      where: { userId, inService: true },
    });
    if (!service) throw fail("Needs a blacksmith in service");
    const owned = await tx.porter.count({ where: { userId } });
    if (owned > 0) throw fail("One porter is enough");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (toGold(user.gold) < ECONOMY.PORTER_PRICE) throw fail("Not enough gold");
    const payment = await tx.user.updateMany({
      where: { id: userId, gold: { gte: ECONOMY.PORTER_PRICE } },
      data: { gold: { decrement: ECONOMY.PORTER_PRICE }, porterOn: true },
    });
    if (!payment.count) throw fail("Not enough gold");
    await tx.porter.create({ data: { userId } });
  });
  return worldState(userId);
}

export async function togglePorter(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const owned = await tx.porter.findFirst({ where: { userId } });
    if (!owned) throw fail("You have no porter");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.porterOn && await tx.listing.count({ where: { sellerId: userId, kind: "PORTER", refId: owned.id, status: "OPEN" } })) {
      throw fail("Cancel the porter listing before turning it on");
    }
    await tx.user.update({ where: { id: userId }, data: { porterOn: !user.porterOn } });
  });
  return worldState(userId);
}

export async function setShieldRepair(userId: string, enabled: boolean) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!(await tx.porter.count({ where: { userId } }))) throw fail("You have no porter");
    await tx.user.update({ where: { id: userId }, data: { shieldRepairOn: enabled } });
  });
  return worldState(userId);
}

export async function setShieldRepairRarity(userId: string, rarity: HeroRarity, enabled: boolean) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!(await tx.porter.count({ where: { userId } }))) throw fail("You have no porter");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const rarities = enabled
      ? [...new Set([...user.shieldRepairRarities, rarity])]
      : user.shieldRepairRarities.filter(value => value !== rarity);
    await tx.user.update({ where: { id: userId }, data: { shieldRepairRarities: rarities } });
  });
  return worldState(userId);
}

export async function listForSale(
  userId: string,
  kind: "HERO" | "BLACKSMITH" | "PORTER",
  refId: string,
  price: number,
) {
  const {BLACKSMITHS}=await runtimeRules();
  if (!Number.isSafeInteger(Math.round(price * 100)) || price < 0.01 || price > 1_000_000_000 || Math.abs(Math.round(price * 100) / 100 - price) > 0.000001) throw fail("Set a valid price with at most two decimals");
  await processTicks(userId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const duplicate = await tx.listing.count({ where: { sellerId: userId, kind, refId, status: "OPEN" } });
    if (duplicate) throw fail("This item is already listed", 409);
    let title: string = kind;
    if (kind === "HERO") {
      const hero = await tx.hero.findFirst({ where: { id: refId, userId } });
      if (!hero) throw fail("Hero not found", 404);
      if (hero.status !== "IDLE") throw fail("Rest the hero before listing it");
      title = `${hero.rarity.replaceAll("_", " ")} ${hero.class}`;
      const changed = await tx.hero.updateMany({ where: { id: refId, userId, status: "IDLE" }, data: { status: "LISTED", forgeMode: "AUTO", dungeonX: null, dungeonY: null } });
      if (!changed.count) throw fail("Hero status changed. Try again.", 409);
    } else if (kind === "BLACKSMITH") {
      const row = await tx.blacksmith.findFirst({ where: { id: refId, userId } });
      if (!row) throw fail("Recovery house not found", 404);
      if (row.inService) throw fail("Take the house out of service first");
      title = BLACKSMITHS[row.tier - 1]?.name ?? "Recovery House";
    } else {
      const row = await tx.porter.findFirst({ where: { id: refId, userId } });
      if (!row) throw fail("Porter not found", 404);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.porterOn) throw fail("Turn off the porter before listing it");
      title = "Porter";
    }
    await tx.listing.create({ data: { sellerId: userId, kind, refId, title, price: new Prisma.Decimal(price.toFixed(2)) } });
  });
  return worldState(userId);
}

export async function buyListing(userId: string, listingId: string) {
  const {ECONOMY}=await runtimeRules();
  const initial = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!initial || initial.status !== "OPEN") throw fail("Listing is gone", 404);
  if (initial.sellerId === userId) throw fail("That is your listing");
  await Promise.all([processTicks(userId), processTicks(initial.sellerId)]);
  await prisma.$transaction(async (tx) => {
    const lockedUsers = [userId, initial.sellerId].sort();
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${Prisma.join(lockedUsers)}) ORDER BY "id" FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`;
    const listing = await tx.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "OPEN") throw fail("Listing is gone", 409);
    const [buyer, seller] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: userId } }),
      tx.user.findUniqueOrThrow({ where: { id: listing.sellerId } }),
    ]);
    if (buyer.wallet.startsWith("demo:") !== seller.wallet.startsWith("demo:")) throw fail("Listing is gone", 404);
    const price = toGold(listing.price);
    const fee = Math.round(price * ECONOMY.MARKET_FEE * 100) / 100;
    const received = price - fee;
    const payment = await tx.user.updateMany({ where: { id: userId, gold: { gte: listing.price } }, data: { gold: { decrement: listing.price } } });
    if (!payment.count) throw fail("Not enough gold");
    if (listing.kind === "HERO") {
      const capacity = await tx.hero.count({ where: { userId } });
      const pending = await tx.summonBatch.aggregate({ where: { userId, status: { in: ["SEALED", "REVEALED"] } }, _sum: { count: true } });
      if (capacity + (pending._sum.count ?? 0) >= ECONOMY.MAX_ACTIVE) throw fail("Hero roster is full");
      const incomingGear = await tx.gearPiece.count({ where: { userId: listing.sellerId, heroId: listing.refId } });
      if (await tx.gearPiece.count({ where: { userId } }) + incomingGear > 500) throw fail("Armory is full");
      const moved = await tx.hero.updateMany({ where: { id: listing.refId, userId: listing.sellerId, status: "LISTED" }, data: { userId, status: "IDLE", forgeMode: "AUTO", dungeonX: null, dungeonY: null } });
      if (!moved.count) throw fail("Hero is no longer available", 409);
      await tx.gearPiece.updateMany({ where: { userId: listing.sellerId, heroId: listing.refId }, data: { userId, lastHeroId: null, movedDay: null } });
    } else if (listing.kind === "BLACKSMITH") {
      const house = await tx.blacksmith.findFirst({ where: { id: listing.refId, userId: listing.sellerId, inService: false } });
      if (!house) throw fail("House is no longer available", 409);
      if (await tx.blacksmith.count({ where: { userId, tier: house.tier } })) throw fail("You already own this house tier");
      await tx.blacksmith.update({ where: { id: house.id }, data: { userId } });
    } else {
      if (await tx.porter.count({ where: { userId } })) throw fail("You already own a porter");
      const moved = await tx.porter.updateMany({ where: { id: listing.refId, userId: listing.sellerId }, data: { userId } });
      if (!moved.count) throw fail("Porter is no longer available", 409);
    }
    await tx.listing.update({ where: { id: listing.id }, data: { status: "SOLD" } });
    await tx.user.update({ where: { id: listing.sellerId }, data: { gold: { increment: received } } });
  }, { timeout: 15000 });
  return worldState(userId);
}

export async function cancelListing(userId: string, listingId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`;
    const listing = await tx.listing.findFirst({ where: { id: listingId, sellerId: userId, status: "OPEN" } });
    if (!listing) throw fail("Listing is gone", 404);
    await tx.listing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
    if (listing.kind === "HERO") await tx.hero.updateMany({ where: { id: listing.refId, userId, status: "LISTED" }, data: { status: "IDLE" } });
  });
  return worldState(userId);
}

export async function withdrawChest(userId: string) {
  const {ECONOMY,BLACKSMITHS}=await runtimeRules();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const chest = toGold(user.chest);
  if (chest < ECONOMY.WITHDRAW_MIN) {
    throw fail(`Withdraw from ${ECONOMY.WITHDRAW_MIN} MHDG`);
  }
  const fee = Math.round(chest * ECONOMY.WITHDRAW_FEE * 100) / 100;
  const net = chest - fee;
  const claimed = await prisma.user.updateMany({
    where: { id: userId, chest: user.chest },
    data: { chest: 0, gold: { increment: net } },
  });
  if (!claimed.count) throw fail("Rewards changed. Please review the amount again.", 409);
  const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { user: toUserDto(updated), fee, net };
}

export async function redeemInvite(userId: string, code: string) {
  const {referrals}=await getConfig();
  const me = await ensureProfile(userId);
  if (me.referredBy) throw fail("You already accepted an invitation.");
  if (me.inviteCode === code) throw fail("You cannot accept your own invitation.");
  const host = await prisma.user.findUnique({ where: { inviteCode: code } });
  if (!host || me.wallet.startsWith("demo:") !== host.wallet.startsWith("demo:")) throw fail("This invitation was not found. Check the link and try again.");
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.user.updateMany({
      where: { id: userId, referredBy: null },
      data: { referredBy: code, mintCards: { increment: referrals.guestCards } },
    });
    if (!claimed.count) throw fail("You already accepted an invitation.");
    await tx.user.update({
      where: { id: host.id },
      data: { mintCards: { increment: referrals.hostCards } },
    });
  });
  return worldState(userId);
}

export type WorldState = Awaited<ReturnType<typeof worldState>>;
export type WorldUser = UserDto;
