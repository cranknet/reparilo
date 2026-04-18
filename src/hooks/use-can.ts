import { Role } from "@shared/constants";
import type { PermissionCheck } from "@shared/permissions";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

const VALID_ROLES: ReadonlySet<string> = new Set(Object.values(Role));

export function can(role: string, permissions: PermissionCheck): boolean {
  if (!VALID_ROLES.has(role)) {
    return false;
  }
  return authClient.admin.checkRolePermission({
    // BA's generic infers keyof roles, not string; cast bridges the gap safely.
    role: role as never,
    // BA expects plain array; PermissionCheck uses NonEmptyArray — identical at runtime.
    permissions: permissions as never,
  });
}

export function useCan(permissions: PermissionCheck): boolean {
  const role = useAuthStore((s) => s.role);
  if (!role) {
    return false;
  }
  return can(role, permissions);
}
