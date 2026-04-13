import { FastifyPluginAsync } from 'fastify';

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate('authenticate', async (request, reply) => {
    // TODO: Implement Better Auth session validation
    // For now, pass through in development
    if (process.env.NODE_ENV === 'development') return;
    return reply.status(401).send({ error: 'Unauthorized' });
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
