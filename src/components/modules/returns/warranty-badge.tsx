import { useTranslation } from "react-i18next";

interface WarrantyBadgeProps {
  daysSinceDelivered: number | null;
  warrantyDays: number;
}

export default function WarrantyBadge({
  daysSinceDelivered,
  warrantyDays,
}: WarrantyBadgeProps) {
  const { t } = useTranslation();

  if (daysSinceDelivered === null) {
    return null;
  }

  const inWarranty = daysSinceDelivered <= warrantyDays;
  const days = inWarranty
    ? warrantyDays - daysSinceDelivered
    : daysSinceDelivered - warrantyDays;

  const className = inWarranty
    ? "inline-flex items-center rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-medium text-on-tertiary-container"
    : "inline-flex items-center rounded-full bg-error-container px-2.5 py-0.5 text-xs font-medium text-on-error-container";

  const text = inWarranty
    ? t("returns_warranty_in_remaining", { days })
    : t("returns_warranty_out_past", { days });

  return <span className={className}>{text}</span>;
}
