import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useJobsStore } from "@/stores/jobs";

export default function QuickIntakeForm() {
  const { t } = useTranslation();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [reportedProblem, setReportedProblem] = useState("");
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const isCreating = useJobsStore((s) => s.isCreatingJob);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await useJobsStore.getState().createJob({
        customerName,
        customerPhone,
        deviceBrand,
        deviceModel,
        reportedProblem,
        estimatedCost,
      });
      setCustomerName("");
      setCustomerPhone("");
      setDeviceBrand("");
      setDeviceModel("");
      setReportedProblem("");
      setEstimatedCost(0);
      setExpanded(false);
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border-primary border-t-4 bg-surface-container-lowest shadow-premium">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between p-6 text-start"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <h2 className="font-bold font-headline text-xl">
          {t("front_desk.quick_intake")}
        </h2>
        <span className="material-symbols-outlined text-primary transition-transform duration-200">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      {expanded && (
        <form className="space-y-4 px-6 pb-6" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
              htmlFor="quick-intake-customer"
            >
              {t("front_desk.customer_name")}
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
              id="quick-intake-customer"
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t("front_desk.customer_name_placeholder")}
              required
              type="text"
              value={customerName}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
                htmlFor="quick-intake-phone"
              >
                {t("front_desk.phone")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-phone"
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder={t("front_desk.phone_placeholder")}
                required
                type="tel"
                value={customerPhone}
              />
            </div>
            <div>
              <label
                className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
                htmlFor="quick-intake-brand"
              >
                {t("front_desk.device_brand")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-brand"
                onChange={(e) => setDeviceBrand(e.target.value)}
                placeholder={t("front_desk.device_brand_placeholder")}
                required
                type="text"
                value={deviceBrand}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
                htmlFor="quick-intake-model"
              >
                {t("front_desk.device_model")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-model"
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder={t("front_desk.device_model_placeholder")}
                required
                type="text"
                value={deviceModel}
              />
            </div>
            <div>
              <label
                className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
                htmlFor="quick-intake-cost"
              >
                {t("front_desk.estimated_cost")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-cost"
                min={0}
                onChange={(e) => setEstimatedCost(Number(e.target.value) || 0)}
                placeholder="0"
                step="0.01"
                type="number"
                value={estimatedCost}
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block font-bold text-on-surface-variant text-xs uppercase tracking-wide"
              htmlFor="quick-intake-issue"
            >
              {t("front_desk.issue_description")}
            </label>
            <textarea
              className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
              id="quick-intake-issue"
              onChange={(e) => setReportedProblem(e.target.value)}
              placeholder={t("front_desk.issue_placeholder")}
              required
              rows={3}
              value={reportedProblem}
            />
          </div>
          <button
            className="mt-2 w-full rounded-xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold text-white shadow-premium transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreating}
            type="submit"
          >
            {isCreating
              ? t("front_desk.creating_job")
              : t("intake.start_repair")}
          </button>
        </form>
      )}
    </div>
  );
}
