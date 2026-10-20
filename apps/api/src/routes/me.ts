import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { toUserDto } from "../lib/mappers.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: authenticate }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
    });
    return toUserDto(user);
  });
}
