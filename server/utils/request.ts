import { AppError } from "@shared/errors/app-error.js";
import type { FastifyRequest } from "fastify";

export function getUserId(req: FastifyRequest): string {
  const id = req.user?.id;
  if (!id) {
    throw new AppError("UNAUTHORIZED");
  }
  return id;
}

export function getSessionId(req: FastifyRequest): string {
  const sessionId = req.user?.sessionId;
  if (!sessionId) {
    throw new AppError("UNAUTHORIZED");
  }
  return sessionId;
}
