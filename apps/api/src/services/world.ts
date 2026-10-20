import { randomBytes } from "node:crypto";
import { type UserDto } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toGold, toUserDto } from "../lib/mappers.js";
import { processTicks } from "./dungeon.js";
import { runtimeRules,getConfig } from "./config.js";

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
  const [blacksmiths, porters, listings] = await Promise.all([
    prisma.blacksmith.findMany({ where: { userId }, orderBy: { tier: "asc" } }),
    prisma.porter.findMany({ where: { userId } }),
    prisma.listing.findMany({
      where: { status: "OPEN", seller: user.wallet.startsWith("demo:") ? { wallet: { startsWith: "demo:" } } : { NOT: { wallet: { startsWith: "demo:" } } } },
      orderBy: { price: "asc" },
      take: 40,
      include: { seller: { select: { displayName: true, wallet: true } } },
    }),
  ]);
  const service = blacksmiths.find((b) => b.inService);
  return {
    user: toUserDto(user),
    blacksmiths: blacksmiths.map((b) => ({
      id: b.id,
      tier: b.tier,
      name: BLACKSMITHS[b.tier - 1]?.name ?? `Tier ${b.tier}`,
      inService: b.inService,
    })),
    serviceName: service ? BLACKSMITHS[service.tier - 1]?.name ?? null : null,
    porters: porters.length,
    porterOn: user.porterOn,
    listings: listings.map((l) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      price: toGold(l.price),
      seller: l.seller.displayName,
      mine: l.sellerId === userId,
    })),
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
  const row = await prisma.blacksmith.findFirst({ where: { id, userId } });
  if (!row) throw fail("Blacksmith not found", 404);
  await prisma.$transaction([
    prisma.blacksmith.updateMany({
      where: { userId },
      data: { inService: false },
    }),
    prisma.blacksmith.update({ where: { id }, data: { inService: true } }),
  ]);
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
  const owned = await prisma.porter.count({ where: { userId } });
  if (!owned) throw fail("You have no porter");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { porterOn: !user.porterOn },
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
  if (!Number.isFinite(price) || price <= 0) throw fail("Set a price");
  await processTicks(userId);
  let title: string = kind;
  if (kind === "HERO") {
    const hero = await prisma.hero.findFirst({ where: { id: refId, userId } });
    if (!hero) throw fail("Hero not found", 404);
    if (hero.status === "HUNTING") throw fail("Deactivate the hero first");
    title = `${hero.rarity} ${hero.class}`;
    await prisma.hero.update({
      where: { id: hero.id },
      data: { status: "LISTED", dungeonX: null, dungeonY: null },
    });
  } else if (kind === "BLACKSMITH") {
    const row = await prisma.blacksmith.findFirst({ where: { id: refId, userId } });
    if (!row) throw fail("Blacksmith not found", 404);
    if (row.inService) throw fail("Take the blacksmith out of service first");
    title = BLACKSMITHS[row.tier - 1]?.name ?? "Blacksmith";
  } else {
    const row = await prisma.porter.findFirst({ where: { id: refId, userId } });
    if (!row) throw fail("Porter not found", 404);
    title = "Porter";
  }

  await prisma.listing.create({
    data: { sellerId: userId, kind, refId, title, price },
  });
  return worldState(userId);
}

export async function buyListing(userId: string, listingId: string) {
  const {ECONOMY,BLACKSMITHS}=await runtimeRules();
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== "OPEN") throw fail("Listing is gone");
  if (listing.sellerId === userId) throw fail("That is your listing");
  const [buyerScope, sellerScope] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { wallet: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: listing.sellerId }, select: { wallet: true } }),
  ]);
  if (buyerScope.wallet.startsWith("demo:") !== sellerScope.wallet.startsWith("demo:")) throw fail("Listing is gone", 404);
  await Promise.all([processTicks(userId), processTicks(listing.sellerId)]);
  const price = toGold(listing.price);
  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (toGold(buyer.gold) < price) throw fail("Not enough gold");
  const fee = Math.round(price * ECONOMY.MARKET_FEE * 100) / 100;
  const received = price - fee;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { gold: { decrement: price } },
    });
    await tx.user.update({
      where: { id: listing.sellerId },
      data: { gold: { increment: received } },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: { status: "SOLD" },
    });
    if (listing.kind === "HERO") {
      await tx.hero.update({
        where: { id: listing.refId },
        data: { userId, status: "IDLE", dungeonX: null, dungeonY: null },
      });
    } else if (listing.kind === "BLACKSMITH") {
      await tx.blacksmith.update({
        where: { id: listing.refId },
        data: { userId, inService: false },
      });
    } else {
      await tx.porter.update({
        where: { id: listing.refId },
        data: { userId },
      });
    }
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
