import type { RoleType } from "@shared/constants/roles";
import { AppError } from "@shared/errors/app-error.js";
import type { PermissionCheck } from "@shared/permissions";
import type { FastifyReply, FastifyRequest } from "fastify";

export function requirePermission(permissions: PermissionCheck) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new AppError("UNAUTHORIZED");
    }

    const result = await request.server.auth.api.userHasPermission({
      body: {
        role: request.user.role as RoleType,
        permissions,
      },
    });

    if (!result.success) {
      throw new AppError("FORBIDDEN");
    }
  };
}
