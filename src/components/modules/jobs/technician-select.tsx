import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "@/hooks/use-can";
import { useTechnicians } from "@/hooks/use-technicians";
import { useJobsStore } from "@/stores/jobs";

interface TechnicianSelectProps {
  currentTechnicianId?: string | null;
  currentTechnicianName?: string | null;
  jobId: string;
  onChanged?: () => void;
  size?: "sm" | "md";
}

export default function TechnicianSelect({
  currentTechnicianId,
  currentTechnicianName,
  jobId,
  onChanged,
  size = "md",
}: TechnicianSelectProps) {
  const { t } = useTranslation();
  const canEdit = useCan({ jobs: ["edit"] });
  const { technicians, isLoading } = useTechnicians();
  const updateJob = useJobsStore((s) => s.updateJob);
  const [assigning, setAssigning] = useState(false);

  const handleChange = useCallback(
    async (techId: string) => {
      const value = techId === "__none__" ? null : techId;
      setAssigning(true);
      try {
        await updateJob(jobId, { technicianId: value });
        onChanged?.();
      } catch (err: unknown) {
        window.console.error(err);
      } finally {
        setAssigning(false);
      }
    },
    [jobId, updateJob, onChanged]
  );

  if (!canEdit) {
    return (
      <span
        className={`font-body font-medium ${size === "sm" ? "text-xs" : "text-sm"}`}
      >
        {currentTechnicianName ?? t("unassigned")}
      </span>
    );
  }

  if (isLoading) {
    return (
      <span
        className={`font-body text-on-surface-variant ${size === "sm" ? "text-xs" : "text-sm"}`}
      >
        {t("loading")}
      </span>
    );
  }

  const selectClass =
    size === "sm"
      ? "rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1 font-body text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      : "rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 font-body text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <select
      className={selectClass}
      disabled={assigning}
      onChange={(e) => handleChange(e.target.value)}
      value={currentTechnicianId ?? "__none__"}
    >
      <option value="__none__">{t("unassigned")}</option>
      {technicians.map((tech) => (
        <option key={tech.id} value={tech.id}>
          {tech.name}
        </option>
      ))}
    </select>
  );
}
