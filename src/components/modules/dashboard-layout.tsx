import type { ReactNode } from "react";
import { useCallback } from "react";
import BottomNav from "@/components/modules/bottom-nav";
import type { IntakeFormData } from "@/components/modules/jobs/intake-modal";
import IntakeModal from "@/components/modules/jobs/intake-modal";
import Sidebar from "@/components/modules/sidebar";
import TopBar from "@/components/modules/top-bar";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const intakeModalOpen = useUiStore((s) => s.intakeModalOpen);
  const closeIntakeModal = useUiStore((s) => s.closeIntakeModal);
  const { createJob, fetchJobs, fetchMetrics } = useJobsStore();

  const handleIntakeSubmit = useCallback(
    async (data: IntakeFormData) => {
      try {
        await createJob({
          customerEmail: data.customerEmail || undefined,
          customerId: data.customerId || undefined,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          deviceBrand: data.brand || undefined,
          deviceModel: data.model,
          color: data.color || undefined,
          reportedProblem: data.reportedProblem,
          conditionNotes: data.conditionNotes || undefined,
          estimatedCost: Number.parseFloat(data.estimatedCost) || 0,
          estimatedDate: data.estimatedDelivery || undefined,
          depositAmount: data.deposit
            ? Number.parseFloat(data.deposit)
            : undefined,
        });
        await fetchJobs();
        await fetchMetrics();
        closeIntakeModal();
      } catch (error) {
        console.error("Failed to create job:", error);
      }
    },
    [createJob, fetchJobs, fetchMetrics, closeIntakeModal]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-background">
      <Sidebar />
      <TopBar />
      <main className="min-h-screen p-4 pt-20 pb-20 md:p-8 md:pt-24 md:pb-24 lg:ml-64 lg:pb-8">
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
