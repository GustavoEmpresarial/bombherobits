import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { prisma } from "../src/lib/prisma.js";
import { adminRoutes } from "../src/routes/admin.js";
import { hashPassword, tokenHash } from "../src/lib/admin-crypto.js";
after(async () => { await prisma.$disconnect(); });
test("creator and whitelist review require an admin session and persist decisions", { skip: process.env.HEROBITS_TEST_DATABASE !== "1" }, async () => {
  const suffix = randomUUID();
  const access = randomBytes(32).toString("hex"), session = randomBytes(32).toString("hex");
  const path = "/_ops-marketingtestabcdefghijkl";
  const admin = await prisma.adminUser.create({ data: { username: "marketing-qa-" + suffix, passwordHash: await hashPassword(randomBytes(32).toString("hex")) } });
  const creator = await prisma.creatorApplication.create({ data: { name: "Disposable creator QA", email: suffix + "@example.invalid", platform: "YouTube", followers: "Under 1,000", channelUrl: "https://example.invalid/" + suffix, language: "English", about: "Disposable local marketing integration test.", disclosure: true } });
  const whitelist = await prisma.whitelistApplication.create({ data: { email: suffix + "@example.invalid", xHandle: suffix.replaceAll("-", "").slice(0, 15), discordUsername: "qa." + suffix.slice(0, 12), followedX: true, joinedDiscord: true } });
  const app = Fastify();
  try {
    await prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: tokenHash(session), expiresAt: new Date(Date.now() + 60000) } });
    await app.register(adminRoutes, { path, accessHash: tokenHash(access) });
    const headers = { "x-admin-access": access, cookie: "herobits_admin=" + session };
    for (const [resource, id] of [["creators", creator.id], ["whitelist", whitelist.id]]) {
      const url = path + "/api/" + resource;
      assert.equal((await app.inject(url)).statusCode, 404);
      assert.equal((await app.inject({ url, headers: { "x-admin-access": access } })).statusCode, 401);
      const list = await app.inject({ url, headers }); assert.equal(list.statusCode, 200); assert(Array.isArray(list.json().applications));
      assert.equal((await app.inject({ method: "PATCH", url: url + "/" + id, headers, payload: { status: "INVALID" } })).statusCode, 400);
      assert.equal((await app.inject({ method: "PATCH", url: url + "/" + id, headers, payload: { status: "APPROVED" } })).statusCode, 200);
    }
    assert.equal((await prisma.creatorApplication.findUniqueOrThrow({ where: { id: creator.id } })).status, "APPROVED");
    const approved = await prisma.whitelistApplication.findUniqueOrThrow({ where: { id: whitelist.id } });
    assert.equal(approved.status, "APPROVED"); assert(approved.reviewedAt);
    await app.inject({ method: "PATCH", url: path + "/api/whitelist/" + whitelist.id, headers, payload: { status: "PENDING" } });
    assert.equal((await prisma.whitelistApplication.findUniqueOrThrow({ where: { id: whitelist.id } })).reviewedAt, null);
  } finally {
    await app.close();
    await prisma.creatorApplication.delete({ where: { id: creator.id } });
    await prisma.whitelistApplication.delete({ where: { id: whitelist.id } });
    await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
    await prisma.adminUser.delete({ where: { id: admin.id } });
  }
});
