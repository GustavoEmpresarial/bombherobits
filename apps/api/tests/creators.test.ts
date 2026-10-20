import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { creatorRoutes, creatorApplicationStore } from "../src/routes/creators.js";
import { creatorApplicationSchema } from "../src/services/creator-validation.js";
import { ADMIN_PAGE } from "../src/admin/admin-page.js";

const application = {
  name: "Test creator", email: "creator@example.invalid", platform: "YouTube",
  followers: "1,000–9,999", channelUrl: "https://www.youtube.com/@example",
  language: "English", about: "I stream weekly and would open hero boxes during a live game review.",
  wallet: "", disclosure: true,
};
test("applications require disclosure, supported selections, safe links and a real Solana address", () => {
  assert(creatorApplicationSchema.safeParse(application).success);
  assert(creatorApplicationSchema.safeParse({ ...application, wallet: "11111111111111111111111111111111" }).success);
  for (const patch of [{ disclosure: false }, { email: "bad" }, { platform: "unknown" }, { followers: "" },
    { language: "" }, { about: "short" }, { wallet: "seed phrase" }, { channelUrl: "javascript:alert(1)" },
    { channelUrl: "https://user:password@example.com" }, { channelUrl: "ftp://example.com" }]) {
    assert(!creatorApplicationSchema.safeParse({ ...application, ...patch }).success, JSON.stringify(patch));
  }
  const parsed = creatorApplicationSchema.parse({ ...application, email: "  Creator@Example.invalid ", name: " Test creator " });
  assert.equal(parsed.email, "creator@example.invalid");
  assert.equal(parsed.name, "Test creator");
});
test("public submission persists privately, deduplicates retries and limits abuse", async context => {
  let saved: any = null;
  context.mock.method(creatorApplicationStore, "findFirst", async () => saved ? { id: "test-id" } : null);
  context.mock.method(creatorApplicationStore, "create", async ({ data }: any) => { saved = data; return { id: "test-id" }; });
  const app = Fastify();
  await app.register(creatorRoutes);
  try {
    const invalid = await app.inject({ method: "POST", url: "/creators/applications", payload: { ...application, disclosure: false } });
    assert.equal(invalid.statusCode, 400); assert.equal(saved, null);
    for (let i = 0; i < 4; i++) {
      const response = await app.inject({ method: "POST", url: "/creators/applications", payload: application });
      assert.equal(response.statusCode, 202);
      assert.deepEqual(response.json(), { accepted: true });
      assert.equal(response.headers["cache-control"], "no-store");
    }
    assert.equal(saved.email, application.email); assert.equal(saved.wallet, null);
    assert.equal((creatorApplicationStore.create as any).mock.callCount(), 1);
    const limited = await app.inject({ method: "POST", url: "/creators/applications", payload: application });
    assert.equal(limited.statusCode, 429);
    assert.equal((await app.inject("/creators/applications")).statusCode, 404);
  } finally { await app.close(); }
});
test("failed storage cannot be shown as a successful application", async context => {
  context.mock.method(creatorApplicationStore, "findFirst", async () => { throw new Error("Storage unavailable"); });
  const app = Fastify(); await app.register(creatorRoutes);
  try {
    const response = await app.inject({ method: "POST", url: "/creators/applications", payload: application });
    assert.equal(response.statusCode, 500);
    assert.notEqual(response.json().accepted, true);
  } finally { await app.close(); }
});
test("creator admin script parses and renders applicant content as text", () => {
  const script = ADMIN_PAGE.split('<script nonce="__NONCE__">')[1].split("</script>")[0];
  assert.doesNotThrow(() => new Function(script));
  assert(script.includes("details.textContent="));
  assert(script.includes("if(current==='creators'){loadCreators();return;}"));
});
