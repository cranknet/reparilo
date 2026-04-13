import { FastifyPluginAsync } from 'fastify';

export const partsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'parts list' };
  });
};
