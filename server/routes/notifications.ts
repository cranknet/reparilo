import { FastifyPluginAsync } from 'fastify';

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'notifications list' };
  });
};
