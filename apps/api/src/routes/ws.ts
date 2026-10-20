import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { getConfig } from "../services/config.js";
import { processTicks } from "../services/dungeon.js";
import { sessionHasAccess, type JwtUser } from "../lib/auth.js";

type SocketMeta = { userId: string; timer?: ReturnType<typeof setInterval> };

const sockets = new Map<WebSocket, SocketMeta>();

export async function wsRoutes(app: FastifyInstance) {
  app.get(
    "/dungeon/ws",
    { websocket: true },
    (socket: WebSocket, request) => {
      const query = request.query as { token?: string };
      let userId: string;
      let session: JwtUser;
      try {
        const payload = app.jwt.verify<JwtUser>(query.token ?? "");
        userId = payload.id;
        session = payload;
      } catch {
        socket.close(4001, "Unauthorized");
        return;
      }

      sockets.set(socket, { userId });

      let sending = false;
      const sendSnapshot = async () => {
        if (sending || socket.readyState !== 1) return;
        sending = true;
        try {
          if (!await sessionHasAccess(session)) { socket.close(4003, "Early access required"); return; }
          const snapshot = await processTicks(userId);
          if (socket.readyState !== 1) return;
          if (snapshot) {
            socket.send(JSON.stringify({ type: "snapshot", data: snapshot }));
          } else {
            socket.send(JSON.stringify({ type: "idle" }));
          }
        } catch (err) {
          console.error("ws tick error", err);
        } finally {
          sending = false;
        }
      };

      const schedule=async()=>{await sendSnapshot();if(socket.readyState!==1)return;const timer=setTimeout(()=>void schedule(),(await getConfig()).game.TICK_MS);sockets.set(socket,{userId,timer});};
      void schedule();

      socket.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string };
          if (msg.type === "ping") {
            socket.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          // ignore bad frames
        }
      });

      socket.on("close", () => {
        const meta = sockets.get(socket);
        if (meta?.timer) clearTimeout(meta.timer);
        sockets.delete(socket);
      });
    },
  );
}
