import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.js";
const where = { email: "creator-ui-qa@example.invalid", channelUrl: "https://example.invalid/creator-qa" };
try {
  const row = await prisma.creatorApplication.findFirst({ where });
  assert(row, "Browser submission must reach PostgreSQL");
  assert.equal(row.status, "PENDING");
  assert.equal(row.disclosure, true);
  assert.equal(row.wallet, null);
  console.log("Verified browser submission persisted with pending status.");
  await prisma.creatorApplication.deleteMany({ where });
  console.log("Disposable QA application removed.");
} finally { await prisma.$disconnect(); }
