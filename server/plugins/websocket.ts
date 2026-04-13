import type { FastifyPluginAsync } from "fastify";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, (socket, req) => {
    if (process.env.AUTH_BYPASS !== "true" && !req.headers.cookie) {
      app.log.warn("WS connection rejected — no auth");
      socket.close(4001, "Unauthorized");
      return;
    }
    app.log.info("WS client connected");
    socket.on("message", (msg: Buffer) => {
      app.log.debug(`WS message: ${msg.toString()}`);
    });
    socket.on("close", () => {
      app.log.info("WS client disconnected");
    });
  });
};
