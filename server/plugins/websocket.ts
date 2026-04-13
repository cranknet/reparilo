import type { FastifyPluginAsync } from "fastify";

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  await app;
  app.get(
    "/ws",
    { websocket: true, preHandler: [app.authenticate] },
    (socket, _req) => {
      app.log.info("WS client connected");
      socket.on("message", (msg: Buffer) => {
        app.log.debug(`WS message: ${msg.toString()}`);
      });
      socket.on("close", () => {
        app.log.info("WS client disconnected");
      });
    }
  );
};
