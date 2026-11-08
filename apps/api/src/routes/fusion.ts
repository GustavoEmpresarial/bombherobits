import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import { fuseHeroes } from "../services/fusion.js";

export async function fusionRoutes(app: FastifyInstance) {
  app.post("/fusion", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ heroIds: z.array(z.string()).length(4), requestId: z.string().min(1).max(128) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose four heroes" });
    try {
      return await fuseHeroes(request.user.id, parsed.data.heroIds, parsed.data.requestId);
    } catch (error) {
      const cause = error as Error & { statusCode?: number };
      return reply.code(cause.statusCode ?? 500).send({ error: cause.message });
    }
  });
}
