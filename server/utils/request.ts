import type { RoleType } from "@shared/constants/roles";
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

export function getRole(req: FastifyRequest): RoleType {
  const role = req.user?.role;
  if (!role) {
    throw new AppError("UNAUTHORIZED");
  }
  return role as RoleType;
}
