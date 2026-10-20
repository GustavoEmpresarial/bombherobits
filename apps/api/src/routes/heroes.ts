import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { toHeroDto } from "../lib/mappers.js";
import { processTicks } from "../services/dungeon.js";

export async function heroesRoutes(app: FastifyInstance) {
  app.get("/heroes", { preHandler: authenticate }, async (request) => {
    await processTicks(request.user.id);
    const heroes = await prisma.hero.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: "asc" },
    });
    return heroes.map(toHeroDto);
  });


  app.post(
    "/heroes/:id/rest",
    { preHandler: authenticate },
    async (request, reply) => {
      await processTicks(request.user.id);
      const { id } = request.params as { id: string };
      const hero = await prisma.hero.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!hero) return reply.code(404).send({ error: "Hero not found" });
      if (hero.status === "LISTED") {
        return reply.code(400).send({ error: "This hero is listed on the market" });
      }

      const updated = await prisma.hero.update({
        where: { id: hero.id },
        data: { status: "IDLE", dungeonX: null, dungeonY: null },
      });
      return toHeroDto(updated);
    },
  );

  app.post(
    "/heroes/:id/deactivate",
    { preHandler: authenticate },
    async (request, reply) => {
      await processTicks(request.user.id);
      const { id } = request.params as { id: string };
      const hero = await prisma.hero.findFirst({
        where: { id, userId: request.user.id },
      });
      if (!hero) return reply.code(404).send({ error: "Hero not found" });
      if (hero.status === "LISTED") {
        return reply.code(400).send({ error: "This hero is listed on the market" });
      }
      const updated = await prisma.hero.update({
        where: { id: hero.id },
        data: { status: "IDLE", dungeonX: null, dungeonY: null },
      });
      return toHeroDto(updated);
    },
  );
}
