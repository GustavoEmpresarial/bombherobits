import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import {
  buildSnapshot,
  deployAllIdle,
  deployHero,
  processTicks,
  startDungeon,
} from "../services/dungeon.js";

export async function dungeonRoutes(app: FastifyInstance) {
  app.post("/dungeon/start", { preHandler: authenticate }, async (request) => {
    return startDungeon(request.user.id);
  });

  app.get("/dungeon/state", { preHandler: authenticate }, async (request, reply) => {
    await processTicks(request.user.id);
    const snapshot = await buildSnapshot(request.user.id);
    if (!snapshot) {
      return reply.code(404).send({ error: "No active dungeon" });
    }
    return snapshot;
  });

  app.post("/dungeon/deploy", { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      heroId: z.string().optional(),
      all: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      if (parsed.data.all) {
        return await deployAllIdle(request.user.id);
      }
      if (!parsed.data.heroId) {
        return reply.code(400).send({ error: "heroId or all required" });
      }
      return await deployHero(request.user.id, parsed.data.heroId);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
