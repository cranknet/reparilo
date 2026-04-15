import type { JobStatusType } from "@shared/constants";
import { DEVICE_ICONS } from "@shared/constants";
import { useTranslation } from "react-i18next";
import StatusBadge from "./status-badge";

interface JobMobileCardProps {
  customer: string;
  customerTier?: string;
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
  customer,
  customerTier,
  technician,
}: JobMobileCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-surface-container-lowest p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
            <span className="material-symbols-outlined text-secondary">
              {DEVICE_ICONS[deviceIcon ?? "other"] ?? "precision_manufacturing"}
            </span>
          </div>
          <div>
            <span className="font-bold font-headline text-[11px] text-primary tracking-tight">
              {id}
            </span>
            <h3 className="font-bold font-headline text-sm">{device}</h3>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-2 flex items-center gap-2 text-on-surface-variant">
        <span className="font-body font-medium text-[11px]">{customer}</span>
        {customerTier && (
          <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-bold font-label text-[11px] text-on-primary-fixed uppercase tracking-wider">
            {customerTier}
          </span>
        )}
      </div>

      <div className="-mx-4 mt-3 flex items-center justify-between bg-surface-container-low px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-highest">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">
              person
            </span>
          </div>
          <span className="font-body font-medium text-[11px] text-on-surface-variant">
            {technician ?? t("unassigned")}
          </span>
        </div>
        <button
          className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg px-2 py-2 font-bold font-label text-[11px] text-primary uppercase tracking-wider transition-colors hover:bg-surface-container-high"
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
