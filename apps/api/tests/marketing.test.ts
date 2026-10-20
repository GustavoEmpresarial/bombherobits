import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { marketingConfig, whitelistSchema } from "../src/services/marketing.js";
import { marketingRoutes, whitelistStore } from "../src/routes/marketing.js";
const application = { email: "QA@example.invalid", xHandle: "@Test_Player", discordUsername: "test.player", wallet: "", followedX: true, joinedDiscord: true };
const env = { BMINER_X_URL: "https://x.com/test_project", BMINER_DISCORD_URL: "https://discord.gg/testinvite", BMINER_WHITELIST_OPEN: "true" };
test("no official links means no open whitelist, contract or buy link", () => {
  assert.deepEqual(marketingConfig({}), { xUrl: null, discordUrl: null, whitelistOpen: false, contract: null, buyUrl: null });
  assert.equal(marketingConfig({ ...env, BMINER_DISCORD_URL: "" }).whitelistOpen, false);
  assert.equal(marketingConfig({ ...env, BMINER_WHITELIST_OPEN: "false" }).whitelistOpen, false);
  assert.equal(marketingConfig(env).whitelistOpen, true);
  assert.equal(marketingConfig({ ...env, BMINER_X_URL: "https://x.com.evil.invalid/foo" }).whitelistOpen, false);
  assert.equal(marketingConfig({ ...env, BMINER_X_URL: "https://user:password@x.com/foo" }).whitelistOpen, false);
  assert.equal(marketingConfig({ BMINER_BUY_URL: "https://pump.fun/test", BMINER_CONTRACT: "not-a-contract" }).buyUrl, null);
});
test("whitelist requires both social declarations and valid identifiers", () => {
  const value = whitelistSchema.parse(application);
  assert.equal(value.xHandle, "test_player"); assert.equal(value.email, "qa@example.invalid");
  for (const patch of [{ followedX: false }, { joinedDiscord: false }, { xHandle: "https://x.com/foo" },
    { discordUsername: "" }, { wallet: "seed phrase" }, { email: "bad-email" }]) {
    assert(!whitelistSchema.safeParse({ ...application, ...patch }).success);
  }
});
test("closed applications cannot be bypassed by posting directly", async context => {
  const previous = process.env.BMINER_WHITELIST_OPEN; process.env.BMINER_WHITELIST_OPEN = "false";
  const create = context.mock.method(whitelistStore, "create", async () => ({}));
  const app = Fastify(); await app.register(marketingRoutes);
  try {
    assert.equal((await app.inject({ method: "POST", url: "/whitelist/applications", payload: application })).statusCode, 503);
    assert.equal(create.mock.callCount(), 0);
    assert.equal((await app.inject("/marketing")).json().whitelistOpen, false);
  } finally { await app.close(); if (previous === undefined) delete process.env.BMINER_WHITELIST_OPEN; else process.env.BMINER_WHITELIST_OPEN = previous; }
});
test("open whitelist stores pending applications without claiming automatic verification", async context => {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  let saved: any;
  context.mock.method(whitelistStore, "create", async ({ data }: any) => { saved = data; return {}; });
  const app = Fastify(); await app.register(marketingRoutes);
  try {
    assert.equal((await app.inject({ method: "POST", url: "/whitelist/applications", payload: { ...application, joinedDiscord: false } })).statusCode, 400);
    assert.equal(saved, undefined);
    const response = await app.inject({ method: "POST", url: "/whitelist/applications", payload: application });
    assert.equal(response.statusCode, 202); assert.deepEqual(response.json(), { accepted: true });
    assert.equal(saved.xHandle, "test_player"); assert.equal(saved.status, undefined); assert.equal(saved.wallet, null);
    context.mock.method(whitelistStore, "create", async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); });
    assert.equal((await app.inject({ method: "POST", url: "/whitelist/applications", payload: application })).statusCode, 202);
  } finally { await app.close(); for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
