import type { RoleType } from "@shared/constants";
import { Role } from "@shared/constants";
import { useEffect } from "react";
import { Route, Routes } from "react-router";
import DashboardLayout from "@/components/modules/dashboard-layout";
import ProtectedRoute from "@/components/modules/protected-route";
import AiAnalystPage from "@/pages/ai-analyst";
import ChangePasswordPage from "@/pages/auth/change-password";
import LoginPage from "@/pages/auth/login";
import ResetPasswordPage from "@/pages/auth/reset-password";
import DashboardPage from "@/pages/dashboard";
import FrontDeskPage from "@/pages/dashboard/front-desk";
import TechnicianDashboardPage from "@/pages/dashboard/technician";
import JobsPage from "@/pages/jobs";
import PartsCatalogPage from "@/pages/parts";
import ProfilePage from "@/pages/profile";
import RepairsPage from "@/pages/repairs";
import SettingsPage from "@/pages/settings";

import TrackingPage from "@/pages/tracking";
import { useAuthStore } from "@/stores/auth";

const DASHBOARD_MAP: Record<RoleType, React.ComponentType> = {
  [Role.OWNER]: DashboardPage,
  [Role.TECHNICIAN]: TechnicianDashboardPage,
  [Role.FRONT_DESK]: FrontDeskPage,
};

export default function App() {
  const role = useAuthStore((s) => s.role);
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const DashboardComponent = DASHBOARD_MAP[role] ?? DashboardPage;

  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ResetPasswordPage />} path="/reset-password" />
      <Route element={<ProtectedRoute requireMustChangePassword={false} />}>
        <Route element={<ChangePasswordPage />} path="/change-password" />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <DashboardLayout>
              <DashboardComponent />
            </DashboardLayout>
          }
          path="/"
        />
        <Route
          element={
            <DashboardLayout>
              <JobsPage />
            </DashboardLayout>
          }
          path="/jobs"
        />
        <Route
          element={
            <DashboardLayout>
              <PartsCatalogPage />
            </DashboardLayout>
          }
          path="/parts"
        />
        <Route
          element={
            <DashboardLayout>
              <RepairsPage />
            </DashboardLayout>
          }
          path="/repairs"
        />
        <Route
          element={
            <DashboardLayout>
              <SettingsPage />
            </DashboardLayout>
          }
          path="/settings"
        />
        <Route
          element={
            <DashboardLayout>
              <AiAnalystPage />
            </DashboardLayout>
          }
          path="/ai-analyst"
        />
        <Route
          element={
            <DashboardLayout>
              <ProfilePage />
            </DashboardLayout>
          }
          path="/profile"
        />
      </Route>
      <Route element={<TrackingPage />} path="/tracking/:jobCode?" />
    </Routes>
  );
}
