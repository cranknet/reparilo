import type { FastifyPluginAsync } from "fastify";

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  await app;
  app.get("/ws", { websocket: true }, (socket, _req) => {
    socket.on("message", (msg: Buffer) => {
      app.log.info(`WS message: ${msg.toString()}`);
    });
  });
};
