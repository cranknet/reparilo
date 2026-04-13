import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";
import DashboardLayout from "@/components/modules/dashboard-layout";
import AiAnalystPage from "@/pages/ai-analyst";
import LoginPage from "@/pages/auth/login";
import DashboardPage from "@/pages/dashboard";
import JobsPage from "@/pages/jobs";
import PartsCatalogPage from "@/pages/parts";
import RepairsPage from "@/pages/repairs";
import SettingsPage from "@/pages/settings";

export default function App() {
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route
        element={
          <DashboardLayout>
            <DashboardPage />
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
        element={<div>{t("tracking_page_title")}</div>}
        path="/tracking/:jobCode"
      />
    </Routes>
  );
}
