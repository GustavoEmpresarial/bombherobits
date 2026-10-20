import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { creatorApplicationSchema } from "../services/creator-validation.js";

// Plain adapter methods keep submission behavior testable without a live database.
export const creatorApplicationStore = {
  findFirst: (args: Parameters<typeof prisma.creatorApplication.findFirst>[0]) => prisma.creatorApplication.findFirst(args),
  create: (args: Parameters<typeof prisma.creatorApplication.create>[0]) => prisma.creatorApplication.create(args),
};

export async function creatorRoutes(app: FastifyInstance) {
  const attempts = new Map<string, { count: number; until: number }>();
  app.post("/creators/applications", { bodyLimit: 8192 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const entry = attempts.get(request.ip) ?? { count: 0, until: now + 60 * 60_000 };
    if (entry.count >= 5 || (!attempts.has(request.ip) && attempts.size >= 10000)) {
      return reply.header("Retry-After", "3600").code(429).send({ error: "Too many applications. Please try again in an hour." });
    }
    entry.count++;
    attempts.set(request.ip, entry);
    const parsed = creatorApplicationSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({
      error: "Please check your application details.",
      fields: parsed.error.flatten().fieldErrors,
    });
    const data = parsed.data;
    // Avoid duplicate submissions after a double click or a lost network response.
    const existing = await creatorApplicationStore.findFirst({
      where: { email: data.email, channelUrl: data.channelUrl, createdAt: { gte: new Date(now - 86400_000) } },
      select: { id: true },
    });
    if (!existing) await creatorApplicationStore.create({ data: { ...data, wallet: data.wallet || null } });
    return reply.code(202).send({ accepted: true });
  });
}
