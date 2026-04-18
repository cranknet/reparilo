import type { RoleType } from "@shared/constants/roles";
import type { PermissionCheck } from "@shared/permissions";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Verifies the requesting user's role has the given permissions.
 * Uses Better Auth's auth.api.userHasPermission — no DB call, purely
 * evaluates the role map registered with the admin plugin.
 */
export function requirePermission(permissions: PermissionCheck) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      await reply.status(401).send({ error: "Authentication required" });
      return;
    }

    const result = await request.server.auth.api.userHasPermission({
      body: {
        role: request.user.role as RoleType,
        permissions,
      },
    });

    if (!result.success) {
      await reply.status(403).send({ error: "Insufficient permissions" });
      return;
    }
  };
}
