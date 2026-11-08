import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import { claimMail, listMail } from "../services/mail.js";

export async function mailRoutes(app: FastifyInstance) {
  app.get("/mail", { preHandler: authenticate }, async request => listMail(request.user.id));
  app.post("/mail/:id/claim", { preHandler: authenticate }, async request => {
    const { id } = request.params as { id: string };
    return claimMail(request.user.id, id);
  });
}
