import type { ReactNode } from "react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import BottomNav from "@/components/modules/bottom-nav";
import type { IntakeFormData } from "@/components/modules/jobs/intake-modal";
import IntakeModal from "@/components/modules/jobs/intake-modal";
import Sidebar from "@/components/modules/sidebar";
import TopBar from "@/components/modules/top-bar";
import api from "@/lib/api";
import { useJobsStore } from "@/stores/jobs";
import { useToastStore } from "@/stores/toast";
import { useUiStore } from "@/stores/ui";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const intakeModalOpen = useUiStore((s) => s.intakeModalOpen);
  const closeIntakeModal = useUiStore((s) => s.closeIntakeModal);
  const { createJob, fetchJobs, fetchMetrics } = useJobsStore();
  const toast = useToastStore((s) => s.toast);
  const { t } = useTranslation();

  const handleIntakeSubmit = useCallback(
    async (data: IntakeFormData) => {
      try {
        const job = await createJob({
          customerEmail: data.customerEmail || undefined,
          customerId: data.customerId || undefined,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deviceBrand: data.brand || "Unknown",
          deviceModel: data.model,
          color: data.color || undefined,
          reportedProblem: data.reportedProblem,
          conditionNotes: data.conditionNotes || undefined,
          estimatedCost:
            Number.parseFloat(data.estimatedCost) ||
            data.repairs.reduce((s, r) => s + r.price, 0) ||
            0,
          estimatedDate: data.estimatedDelivery || undefined,
          depositAmount: data.deposit
            ? Number.parseFloat(data.deposit)
            : undefined,
          repairs:
            data.repairs.length > 0
              ? data.repairs.map((r) => ({
                  ...r,
                  price: Number(r.price) || 0,
                }))
              : undefined,
        });
        toast(t("jobs_created_success", { id: job.jobCode || job.id }));
        window.open(`/api/receipts/${job.id}/label`, "_blank");
        if (data.photos.length > 0) {
          await Promise.allSettled(
            data.photos.map((file) => {
              const formData = new FormData();
              formData.append("file", file);
              return api.post(`/jobs/${job.id}/photos`, formData);
            })
          );
        }
        await fetchJobs();
        await fetchMetrics();
        closeIntakeModal();
      } catch {
        toast(t("jobs_create_error"), "error");
      }
    },
    [createJob, fetchJobs, fetchMetrics, closeIntakeModal, toast, t]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-background">
      <Sidebar />
      <TopBar />
      <main className="min-h-screen p-4 pt-20 pb-20 md:p-8 md:pt-24 md:pb-24 lg:ms-64 lg:pb-8">
        {children}
      </main>
      <BottomNav />
      <IntakeModal
        onClose={closeIntakeModal}
        onSubmit={handleIntakeSubmit}
        open={intakeModalOpen}
      />
    </div>
  );
}
