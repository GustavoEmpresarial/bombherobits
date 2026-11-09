import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import { claimHallMilestone, claimHallRace, hallState, retireHeroes } from "../services/hall.js";

export async function hallRoutes(app: FastifyInstance) {
  app.get("/hall", { preHandler: authenticate }, async request => hallState(request.user.id));
  app.post("/hall/retire", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ heroIds: z.array(z.string().min(1)).min(1).max(15), requestKey: z.string().min(8).max(80) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose heroes and a retirement request key" });
    try { return await retireHeroes(request.user.id, parsed.data.heroIds, parsed.data.requestKey); }
    catch (cause) { const error = cause as Error & { statusCode?: number }; return reply.code(error.statusCode ?? 500).send({ error: error.message }); }
  });
  app.post("/hall/claim", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ milestone: z.number().int().positive() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose a valid milestone" });
    try { return await claimHallMilestone(request.user.id, parsed.data.milestone); }
    catch (cause) { const error = cause as Error & { statusCode?: number }; return reply.code(error.statusCode ?? 500).send({ error: error.message }); }
  });
  app.post("/hall/race", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ threshold: z.number().int().positive() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose a valid race prize" });
    try { return await claimHallRace(request.user.id, parsed.data.threshold); }
    catch (cause) { const error = cause as Error & { statusCode?: number }; return reply.code(error.statusCode ?? 500).send({ error: error.message }); }
  });
}
