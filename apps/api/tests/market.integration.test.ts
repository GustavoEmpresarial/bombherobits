import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { buyListing, cancelListing, listForSale, setBlacksmithService, togglePorter, worldState } from "../src/services/world.js";

after(() => prisma.$disconnect());

test("market listing, purchase and cancellation transfer only one item", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const seller = await prisma.user.create({ data: {
    wallet: `demo:market-seller-${randomUUID()}`, displayName: "Market seller",
    heroes: { create: Array.from({ length: 2 }, () => ({ class: "WARRIOR" as const, rarity: "COMMON" as const, atk: 8, spd: 1, stamina: 100, maxStamina: 100 })) },
  } });
  const buyer = await prisma.user.create({ data: { wallet: `demo:market-buyer-${randomUUID()}`, displayName: "Market buyer" } });
  try {
    const [first, second] = await prisma.hero.findMany({ where: { userId: seller.id } });
    await listForSale(seller.id, "HERO", first.id, 100);
    await assert.rejects(() => listForSale(seller.id, "HERO", first.id, 100), /already listed|Rest the hero/);
    const offer = await prisma.listing.findFirstOrThrow({ where: { sellerId: seller.id, refId: first.id } });
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: first.id } })).status, "LISTED");
    await buyListing(buyer.id, offer.id);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: first.id } })).userId, buyer.id);
    assert.equal((await prisma.listing.findUniqueOrThrow({ where: { id: offer.id } })).status, "SOLD");
    await assert.rejects(() => buyListing(buyer.id, offer.id), /Listing is gone/);
    assert.equal(Number((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).gold), 400);
    await listForSale(seller.id, "HERO", second.id, 75);
    const secondOffer = await prisma.listing.findFirstOrThrow({ where: { sellerId: seller.id, refId: second.id } });
    await cancelListing(seller.id, secondOffer.id);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: second.id } })).status, "IDLE");
    assert.equal((await prisma.listing.findUniqueOrThrow({ where: { id: secondOffer.id } })).status, "CANCELLED");
    assert.equal((await worldState(seller.id)).myListings.length, 0);
    const house = await prisma.blacksmith.create({ data: { userId: seller.id, tier: 1, inService: false } });
    await listForSale(seller.id, "BLACKSMITH", house.id, 200);
    await assert.rejects(() => setBlacksmithService(seller.id, house.id), /Cancel this house listing/);
    const houseOffer = await prisma.listing.findFirstOrThrow({ where: { sellerId: seller.id, refId: house.id, status: "OPEN" } });
    await cancelListing(seller.id, houseOffer.id);
    await setBlacksmithService(seller.id, house.id);
    const porter = await prisma.porter.create({ data: { userId: seller.id } });
    await listForSale(seller.id, "PORTER", porter.id, 50);
    await assert.rejects(() => togglePorter(seller.id), /Cancel the porter listing/);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [seller.id, buyer.id] } } });
  }
});
