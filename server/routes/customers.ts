import { FastifyPluginAsync } from 'fastify';

export const customersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_req, _reply) => {
    return { message: 'customers list' };
  });
};
