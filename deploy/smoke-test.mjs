import assert from "node:assert/strict";
import { prisma } from "../apps/api/dist/lib/prisma.js";
const base = "http://web";
const email = "deployment-qa@example.invalid";
const channelUrl = "https://example.invalid/herobits-deployment-qa";
const send = (path, body) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
try {
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal((await fetch(base + "/api/config")).status, 200);
  assert.equal((await send("/api/auth/nonce", { wallet: "11111111111111111111111111111111" })).status, 403);
  assert.equal((await send("/api/whitelist/applications", {})).status, 503);
  assert.equal((await send("/api/creators/applications", { email })).status, 400);
  const application = { name: "Disposable deployment QA", email, platform: "YouTube", followers: "Under 1,000", channelUrl, language: "English", about: "Disposable production deployment test; no actual creator or content.", wallet: "", disclosure: true };
  assert.equal((await send("/api/creators/applications", application)).status, 202);
  assert.equal((await send("/api/creators/applications", application)).status, 202);
  const rows = await prisma.creatorApplication.findMany({ where: { email, channelUrl } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "PENDING");
  assert.equal((await fetch(base + process.env.ADMIN_PATH + "/api/creators")).status, 404);
  console.log("PASS: API, closed game, closed whitelist, creator validation, persistence, retry deduplication and private admin gate.");
} finally {
  await prisma.creatorApplication.deleteMany({ where: { email, channelUrl } });
  await prisma.$disconnect();
  console.log("Disposable deployment test data removed.");
}
