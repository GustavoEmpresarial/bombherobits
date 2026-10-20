import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import {
  buyBlacksmith,
  buyListing,
  buyPorter,
  listForSale,
  redeemInvite,
  setBlacksmithService,
  togglePorter,
  withdrawChest,
  worldState,
} from "../services/world.js";

function sendError(err: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  const e = err as Error & { statusCode?: number };
  return reply.code(e.statusCode ?? 500).send({ error: e.message });
}

export async function worldRoutes(app: FastifyInstance) {
  app.get("/world", { preHandler: authenticate }, async (request) => {
    return worldState(request.user.id);
  });

  app.post("/blacksmiths/buy", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ tier: z.number().int().min(1).max(6) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid tier" });
    try {
      return await buyBlacksmith(request.user.id, parsed.data.tier);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/blacksmiths/service", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ id: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid id" });
    try {
      return await setBlacksmithService(request.user.id, parsed.data.id);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/porters/buy", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await buyPorter(request.user.id);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/porters/toggle", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await togglePorter(request.user.id);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/market/list", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z
      .object({
        kind: z.enum(["HERO", "BLACKSMITH", "PORTER"]),
        refId: z.string(),
        price: z.number().positive(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid listing" });
    try {
      return await listForSale(
        request.user.id,
        parsed.data.kind,
        parsed.data.refId,
        parsed.data.price,
      );
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/market/buy", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ id: z.string() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid id" });
    try {
      return await buyListing(request.user.id, parsed.data.id);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/chest/withdraw", { preHandler: authenticate }, async (request, reply) => {
    try {
      return await withdrawChest(request.user.id);
    } catch (err) {
      return sendError(err, reply);
    }
  });

  app.post("/invites/redeem", { preHandler: authenticate }, async (request, reply) => {
    const parsed = z.object({ code: z.string().min(4) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid code" });
    try {
      return await redeemInvite(request.user.id, parsed.data.code.trim());
    } catch (err) {
      return sendError(err, reply);
    }
  });
}
