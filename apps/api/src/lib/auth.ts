import type { FastifyRequest, FastifyReply } from "fastify";
import { hasGameAccess, EARLY_ACCESS_MESSAGE } from "../services/early-access.js";

import { prisma } from "./prisma.js";

export type JwtUser = { id: string; wallet: string; demo?: boolean };

export async function sessionHasAccess(session: JwtUser) {
  if (session.demo === true) {
    if (!session.wallet.startsWith("demo:")) return false;
    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { wallet: true } });
    return user?.wallet === session.wallet;
  }
  if (session.wallet.startsWith("demo:")) return false;
  return hasGameAccess(session.wallet);
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  if (!await sessionHasAccess(request.user)) {
    return reply.code(403).send({ error: EARLY_ACCESS_MESSAGE, code: "EARLY_ACCESS_REQUIRED" });
  }
}
