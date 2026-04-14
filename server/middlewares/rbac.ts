import { ROLE_PERMISSIONS, type RoleType } from "@shared/constants/roles";
import type { FastifyReply, FastifyRequest } from "fastify";

type Permission = string;

const ROLE_PERMS: Record<RoleType, Permission[]> = ROLE_PERMISSIONS;

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    const userPermissions = ROLE_PERMS[request.user.role as RoleType] ?? [];

    if (!userPermissions.includes(permission)) {
      await reply.status(403).send({ error: "Insufficient permissions" });
      return;
    }
  };
}
