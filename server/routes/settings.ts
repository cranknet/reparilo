import { FastifyPluginAsync } from 'fastify';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'settings' };
  });
};
