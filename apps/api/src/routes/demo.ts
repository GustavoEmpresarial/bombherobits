import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import type { HeroClass, HeroRarity } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toUserDto } from "../lib/mappers.js";
import { getConfig } from "../services/config.js";
import { heroStats } from "../services/summon.js";

export async function demoRoutes(app: FastifyInstance) {
  const attempts = new Map<string, { count: number; expires: number }>();
  app.post("/demo/session", async (request, reply) => {
    const now = Date.now();
    for (const [ip, row] of attempts) if (row.expires <= now) attempts.delete(ip);
    const row = attempts.get(request.ip) ?? { count: 0, expires: now + 3600000 };
    if (row.count >= 20 || attempts.size >= 10000) return reply.code(429).send({ error: "Too many demo sessions. Try again later." });
    row.count++; attempts.set(request.ip, row);
    const config = await getConfig();
    const classes: HeroClass[] = ["WARRIOR", "MAGE", "ROGUE"];
    const rarities: HeroRarity[] = ["COMMON", "RARE", "SUPER_RARE", "EPIC", "LEGENDARY", "SUPER_LEGENDARY"];
    const user = await prisma.user.create({ data: {
      wallet: `demo:${randomBytes(24).toString("hex")}`,
      displayName: "Demo Adventurer",
      gold: 100000, chest: 5000, mintCards: 15,
      inviteCode: `de${randomBytes(8).toString("hex")}`,
      heroes: { create: rarities.flatMap(rarity => classes.map(heroClass => ({ class: heroClass, rarity, ...heroStats(heroClass, rarity, config) }))) },
    } });
    const token = app.jwt.sign({ id: user.id, wallet: user.wallet, demo: true }, { expiresIn: "24h" });
    return reply.header("Cache-Control", "no-store").send({ token, user: toUserDto(user) });
  });
}
