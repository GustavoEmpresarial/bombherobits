import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../apps/api/dist/lib/prisma.js";
import { hashPassword, tokenHash } from "../apps/api/dist/lib/admin-crypto.js";

const folder = "/run/herobits";
try {
  const env = await readFile(folder + "/.env", "utf8");
  if (/^ADMIN_PATH=/m.test(env) || await prisma.adminUser.count()) {
    console.log("Admin already configured; existing credentials preserved.");
  } else {
    const path = "/_ops-" + randomBytes(18).toString("hex");
    const token = randomBytes(32).toString("base64url");
    const password = randomBytes(24).toString("base64url");
    const username = "owner-" + randomBytes(4).toString("hex");
    // Persist the recovery details privately before creating the account.
    await writeFile(folder + "/admin-access.txt", "HeroBits production admin\nURL: http://5.189.157.88" + path + "#access=" + token + "\nUsername: " + username + "\nPassword: " + password + "\n", { mode: 0o600, flag: "wx" });
    await prisma.adminUser.create({ data: { username, passwordHash: await hashPassword(password) } });
    await writeFile(folder + "/.env", env + "\nADMIN_PATH=" + path + "\nADMIN_ACCESS_TOKEN_HASH=" + tokenHash(token) + "\n", { mode: 0o600 });
    console.log("Admin configured. Recovery details stored privately on the server.");
  }
} finally { await prisma.$disconnect(); }
