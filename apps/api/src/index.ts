import { summonRoutes } from "./routes/summons.js";
import { creatorRoutes } from "./routes/creators.js";
import { marketingRoutes } from "./routes/marketing.js";
import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { demoRoutes } from "./routes/demo.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { heroesRoutes } from "./routes/heroes.js";
import { dungeonRoutes } from "./routes/dungeon.js";
import { wsRoutes } from "./routes/ws.js";
import { worldRoutes } from "./routes/world.js";
import { adminRoutes } from "./routes/admin.js";
import { getSettings } from "./services/config.js";

const port = Number(process.env.API_PORT ?? 3001);
const secret = process.env.JWT_SECRET ?? "herobits-dev-secret-change-me";

async function main() {
  const app = Fastify({ trustProxy: process.env.TRUST_PROXY === "true", logger: { redact: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-admin-access", "res.headers.set-cookie"], serializers: { req(request) { return { method: request.method, url: request.url?.split("?")[0], remoteAddress: request.ip }; } } } });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      if (!body || body === "") {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? true });
  await app.register(jwt, { secret });
  await app.register(websocket);

  app.get("/health", async () => ({ ok: true }));
  app.get("/config", async (_request,reply) => reply.header("Cache-Control","no-store").send(await getSettings()));

  await app.register(authRoutes);
  await app.register(demoRoutes);
  await app.register(creatorRoutes);
  await app.register(marketingRoutes);
  await app.register(meRoutes);
  await app.register(heroesRoutes);
  await app.register(summonRoutes);
  await app.register(dungeonRoutes);
  await app.register(wsRoutes);
  await app.register(worldRoutes);
  await app.register(adminRoutes);

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Bomb Hero Bits API on http://localhost:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
