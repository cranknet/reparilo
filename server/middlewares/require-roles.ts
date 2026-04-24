import type { FastifyReply, FastifyRequest } from "fastify";

export function requireRoles(...allowed: string[]) {
  const set = new Set(allowed);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }
    if (!set.has(req.user.role)) {
      await reply.status(403).send({ error: "Insufficient permissions" });
      return;
    }
  };
}
