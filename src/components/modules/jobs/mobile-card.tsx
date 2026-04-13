import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";
import StatusBadge from "./status-badge";

const DEVICE_ICONS: Record<string, string> = {
  phone: "smartphone",
  tablet: "tablet_mac",
  laptop: "laptop_mac",
  watch: "watch",
  other: "precision_manufacturing",
};

export interface JobMobileCardProps {
  customer: string;
  device: string;
  deviceIcon?: string;
  id: string;
  status: JobStatusType;
  technician?: string;
}

export default function JobMobileCard({
  id,
  device,
  deviceIcon,
  status,
  technician,
}: JobMobileCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high">
            <span className="material-symbols-outlined text-secondary">
              {DEVICE_ICONS[deviceIcon ?? "other"] ?? "precision_manufacturing"}
            </span>
          </div>
          <div>
            <span className="font-bold font-headline text-[10px] text-primary tracking-tight">
              {id}
            </span>
            <h3 className="font-bold font-headline text-sm">{device}</h3>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex items-center justify-between border-surface-container-high border-t pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-highest">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
              person
            </span>
          </div>
          <span className="font-body font-medium text-on-surface-variant text-xs">
            {technician ?? t("unassigned")}
          </span>
        </div>
        <button
          className="flex items-center gap-1 font-bold text-[10px] text-primary uppercase tracking-wider"
          type="button"
        >
          {t("details")}
          <span className="material-symbols-outlined text-sm">
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}
