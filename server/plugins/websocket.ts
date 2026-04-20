import type { FastifyPluginAsync } from "fastify";
import { getSessionFromRequest } from "../lib/auth.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, async (socket, req) => {
    const session = await getSessionFromRequest(app.auth, req);
    if (!session) {
      app.log.warn("WS connection rejected — invalid session");
      socket.close(4001, "Unauthorized");
      return;
    }
    app.log.info({ userId: session.id }, "WS client connected");
    socket.on("message", (msg: Buffer) => {
      app.log.debug(`WS message: ${msg.toString()}`);
    });
    socket.on("close", () => {
      app.log.info("WS client disconnected");
    });
  });
};
