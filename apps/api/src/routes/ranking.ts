import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import { summonRanking } from "../services/ranking.js";

export async function rankingRoutes(app: FastifyInstance) {
  app.get("/ranking/summons", { preHandler: authenticate }, async (request) => summonRanking(request.user.id));
}
