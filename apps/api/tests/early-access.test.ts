import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { hasGameAccess, earlyAccessStore } from "../src/services/early-access.js";
import { authenticate } from "../src/lib/auth.js";

test("closed early access rejects everyone without consulting whitelist approvals", async context => {
  const old = process.env.BMINER_EARLY_ACCESS_OPEN;
  delete process.env.BMINER_EARLY_ACCESS_OPEN;
  const lookup = context.mock.method(earlyAccessStore, "approved", async () => ({ id: "approved" }));
  try {
    assert.equal(await hasGameAccess("approved-wallet"), false);
    assert.equal(lookup.mock.callCount(), 0);
  } finally { if (old === undefined) delete process.env.BMINER_EARLY_ACCESS_OPEN; else process.env.BMINER_EARLY_ACCESS_OPEN = old; }
});
test("open early access still requires an approved wallet", async context => {
  const old = process.env.BMINER_EARLY_ACCESS_OPEN; process.env.BMINER_EARLY_ACCESS_OPEN = "true";
  context.mock.method(earlyAccessStore, "approved", async wallet => wallet === "approved-wallet" ? { id: "approved" } : null);
  try {
    assert.equal(await hasGameAccess("approved-wallet"), true);
    assert.equal(await hasGameAccess("pending-wallet"), false);
    assert.equal(await hasGameAccess(""), false);
  } finally { if (old === undefined) delete process.env.BMINER_EARLY_ACCESS_OPEN; else process.env.BMINER_EARLY_ACCESS_OPEN = old; }
});
test("a valid existing player token cannot bypass the closed game", async () => {
  const old = process.env.BMINER_EARLY_ACCESS_OPEN; process.env.BMINER_EARLY_ACCESS_OPEN = "false";
  const app = Fastify(); await app.register(jwt, { secret: "early-access-unit-test-secret" });
  app.get("/game-test", { preHandler: authenticate }, async () => ({ entered: true }));
  try {
    const token = app.jwt.sign({ id: "existing-player", wallet: "previous-wallet" });
    const blocked = await app.inject({ url: "/game-test", headers: { authorization: "Bearer " + token } });
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.json().code, "EARLY_ACCESS_REQUIRED");
    assert.equal(blocked.json().entered, undefined);
    assert.equal((await app.inject("/game-test")).statusCode, 401);
  } finally { await app.close(); if (old === undefined) delete process.env.BMINER_EARLY_ACCESS_OPEN; else process.env.BMINER_EARLY_ACCESS_OPEN = old; }
});
