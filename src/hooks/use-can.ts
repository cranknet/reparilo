import type { PermissionCheck } from "@shared/permissions";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

/**
 * Non-hook variant — safe to call inside .map / .filter. Caller supplies the role.
 */
export function can(role: string, permissions: PermissionCheck): boolean {
  return authClient.admin.checkRolePermission({
    // BA's generic infers keyof roles, not string; cast bridges the gap safely.
    role: role as never,
    // BA expects plain array; PermissionCheck uses NonEmptyArray — identical at runtime.
    permissions: permissions as never,
  });
}

/**
 * Hook variant — reads role from the auth store, for single checks in component bodies.
 */
export function useCan(permissions: PermissionCheck): boolean {
  const role = useAuthStore((s) => s.role);
  return can(role, permissions);
}
