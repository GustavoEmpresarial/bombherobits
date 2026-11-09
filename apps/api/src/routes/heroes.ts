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
      if (hero.status !== "IDLE") return reply.code(400).send({ error: "Rest this hero and remove any market listing first" });
      const changed = await prisma.hero.updateMany({ where: { id: hero.id, userId: request.user.id, status: "IDLE" }, data: { active: false, forgeMode: "AUTO" } });
      if (!changed.count) return reply.code(409).send({ error: "Hero status changed. Try again." });
      return toHeroDto(await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } }));
    },
  );

  app.post("/heroes/:id/activate", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${request.user.id} FOR UPDATE`;
        const hero = await tx.hero.findFirst({ where: { id, userId: request.user.id } });
        if (!hero) return reply.code(404).send({ error: "Hero not found" });
        if (hero.status === "LISTED") return reply.code(400).send({ error: "Cancel this hero's listing first" });
        if (hero.active) return toHeroDto(hero);
        const active = await tx.hero.count({ where: { userId: request.user.id, active: true } });
        if (active >= 50) return reply.code(400).send({ error: "Team is full (50 active heroes)" });
        return toHeroDto(await tx.hero.update({ where: { id }, data: { active: true } }));
      });
    } catch (cause) {
      return reply.code(500).send({ error: cause instanceof Error ? cause.message : "Could not activate hero" });
    }
  });
}
