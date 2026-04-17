import type { RoleType } from "@shared/constants";
import type { PermissionCheck } from "@shared/permissions";
import { Navigate, Outlet } from "react-router";
import { useCan } from "@/hooks/use-can";
import { useAuthStore } from "@/stores/auth";

interface ProtectedRouteProps {
  requireMustChangePassword?: boolean;
}

export default function ProtectedRoute({
  requireMustChangePassword = true,
}: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
          <span className="font-medium text-on-surface-variant">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  if (requireMustChangePassword && mustChangePassword) {
    return <Navigate replace to="/change-password" />;
  }

  return <Outlet />;
}

interface RequireRoleProps {
  roles: RoleType[];
}

export function RequireRole({ roles }: RequireRoleProps) {
  const role = useAuthStore((s) => s.role);

  if (!roles.includes(role)) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}

interface RequirePermissionProps {
  perm: PermissionCheck;
}

export function RequirePermission({ perm }: RequirePermissionProps) {
  const allowed = useCan(perm);
  if (!allowed) {
    return <Navigate replace to="/" />;
  }
  return <Outlet />;
}
