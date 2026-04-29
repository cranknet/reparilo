import { AppError } from "@shared/errors/app-error.js";
import type { FastifyReply, FastifyRequest } from "fastify";

export function requireRoles(...allowed: string[]) {
  const set = new Set(allowed);
  return (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      throw new AppError("UNAUTHORIZED");
    }
    if (!set.has(req.user.role)) {
      throw new AppError("FORBIDDEN");
    }
    return Promise.resolve();
  };
}
