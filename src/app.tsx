import type { RoleType } from "@shared/constants";
import { Role } from "@shared/constants";
import { Route, Routes } from "react-router";
import DashboardLayout from "@/components/modules/dashboard-layout";
import AiAnalystPage from "@/pages/ai-analyst";
import LoginPage from "@/pages/auth/login";
import DashboardPage from "@/pages/dashboard";
import FrontDeskPage from "@/pages/dashboard/front-desk";
import TechnicianDashboardPage from "@/pages/dashboard/technician";
import JobsPage from "@/pages/jobs";
import PartsCatalogPage from "@/pages/parts";
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
  const DashboardComponent = DASHBOARD_MAP[role];

  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
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
      <Route element={<TrackingPage />} path="/tracking/:jobCode?" />
    </Routes>
  );
}
