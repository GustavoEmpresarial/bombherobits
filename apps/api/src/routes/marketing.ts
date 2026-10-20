import type { FastifyInstance } from "fastify";
import { marketingConfig, whitelistSchema } from "../services/marketing.js";
import { prisma } from "../lib/prisma.js";

export const whitelistStore = {
  create: (args: Parameters<typeof prisma.whitelistApplication.create>[0]) => prisma.whitelistApplication.create(args),
};
export async function marketingRoutes(app: FastifyInstance) {
  const attempts = new Map<string, { count: number; until: number }>();
  app.get("/marketing", async (_request, reply) => reply.header("Cache-Control", "no-store").send(marketingConfig()));
  app.post("/whitelist/applications", { bodyLimit: 4096 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!marketingConfig().whitelistOpen) return reply.code(503).send({ error: "Whitelist opens after our official X and Discord launch. Check back soon." });
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const entry = attempts.get(request.ip) ?? { count: 0, until: now + 3600000 };
    if (entry.count >= 5 || (!attempts.has(request.ip) && attempts.size >= 10000)) return reply.code(429).send({ error: "Too many requests. Please try again in an hour." });
    entry.count++; attempts.set(request.ip, entry);
    const result = whitelistSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ error: "Check your email, X handle and Discord username, and complete both community steps." });
    try {
      await whitelistStore.create({ data: { ...result.data, wallet: result.data.wallet || null } });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      // Same generic response for repeated identifiers; never disclose membership.
    }
    return reply.code(202).send({ accepted: true });
  });
}
