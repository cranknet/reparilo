import { FastifyPluginAsync } from 'fastify';

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'users list' };
  });
};
