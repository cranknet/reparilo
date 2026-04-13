import { FastifyPluginAsync } from 'fastify';

export const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket, _req) => {
    socket.on('message', (msg: Buffer) => {
      app.log.info(`WS message: ${msg.toString()}`);
    });
  });
};
