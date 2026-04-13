import { FastifyPluginAsync } from 'fastify';

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'jobs list' };
  });
};
