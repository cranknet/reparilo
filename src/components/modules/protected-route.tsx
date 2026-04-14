import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "@/stores/auth";

export default function ProtectedRoute() {
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

  if (mustChangePassword) {
    return <Navigate replace to="/change-password" />;
  }

  return <Outlet />;
}
