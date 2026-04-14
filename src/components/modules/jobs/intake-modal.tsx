import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CustomerFormData } from "@/components/modules/jobs/quick-add-customer";
import QuickAddCustomer from "@/components/modules/jobs/quick-add-customer";

type DeviceCategory = "phone" | "tablet" | "laptop" | "watch";

interface IntakeFormData {
  brand: string;
  color: string;
  conditionNotes: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deposit: string;
  deviceCategory: DeviceCategory;
  estimatedCost: string;
  estimatedDelivery: string;
  isWarrantyReturn: boolean;
  model: string;
  reportedProblem: string;
}

const INITIAL_FORM: IntakeFormData = {
  brand: "",
  color: "",
  conditionNotes: "",
  customerEmail: "",
  customerName: "",
  customerPhone: "",
  deposit: "",
  deviceCategory: "phone",
  estimatedCost: "",
  estimatedDelivery: "",
  isWarrantyReturn: false,
  model: "",
  reportedProblem: "",
};

interface IntakeModalProps {
  onClose: () => void;
  onSubmit: (data: IntakeFormData) => void;
  open: boolean;
}

const DEVICE_CATEGORIES: {
  icon: string;
  key: DeviceCategory;
  labelKey: string;
}[] = [
  { icon: "smartphone", key: "phone", labelKey: "intake.category_phone" },
  { icon: "tablet_mac", key: "tablet", labelKey: "intake.category_tablet" },
  { icon: "laptop_mac", key: "laptop", labelKey: "intake.category_laptop" },
  { icon: "watch", key: "watch", labelKey: "intake.category_watch" },
];

const BRANDS = [
  "Apple iPhone",
  "Samsung Galaxy",
  "Google Pixel",
  "Huawei",
  "Xiaomi",
  "Oppo",
  "OnePlus",
  "Other",
];

export type { IntakeFormData };

const labelCls =
  "mb-1.5 ml-1 block font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant";
const inputCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const textareaCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";

export default function IntakeModal({
  onClose,
  onSubmit,
  open,
}: IntakeModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<IntakeFormData>(INITIAL_FORM);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const update = useCallback(
    <K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(form);
      setForm(INITIAL_FORM);
      onClose();
    },
    [form, onSubmit, onClose]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
    >
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="glass-modal ambient-shadow relative z-10 mx-4 flex w-full max-w-[960px] flex-col overflow-hidden rounded-xl sm:mx-6">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <header className="flex items-center justify-between bg-surface-container-lowest/40 px-8 py-6">
            <div className="flex items-center gap-4">
              <h1 className="font-bold font-headline text-2xl text-on-surface tracking-tight">
                {t("intake.title")}
              </h1>
              <span className="rounded-full bg-primary-fixed px-3 py-1 font-bold font-headline text-on-primary-fixed text-xs uppercase tracking-widest">
                {t("intake.job_code")}
              </span>
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </header>

          {/* Body: Two Column Asymmetric Layout */}
          <div className="flex flex-1 flex-col overflow-y-auto md:flex-row">
            {/* Left Column (60%) — Customer & Device */}
            <section className="w-full space-y-8 bg-surface-container-low p-8 md:w-[60%]">
              {/* Customer */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                    <span className="material-symbols-outlined text-primary">
                      person
                    </span>
                    {t("intake.customer_section")}
                  </h2>
                  <button
                    className="font-bold font-headline text-primary text-sm hover:underline"
                    onClick={() => setShowQuickAdd(!showQuickAdd)}
                    type="button"
                  >
                    {t("intake.quick_add")}
                  </button>
                </div>

                {showQuickAdd && (
                  <QuickAddCustomer
                    onAdd={(data: CustomerFormData) => {
                      update("customerName", data.name);
                      update("customerPhone", data.phone);
                      update("customerEmail", data.email);
                      setShowQuickAdd(false);
                    }}
                    onClose={() => setShowQuickAdd(false)}
                  />
                )}

                <div className="space-y-4">
                  <div className="relative">
                    <label className={labelCls} htmlFor="customer-search">
                      {t("intake.customer_search")}
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute top-1/2 right-4 -translate-y-1/2 text-outline">
                        search
                      </span>
                      <input
                        className={inputCls}
                        id="customer-search"
                        onChange={(e) => update("customerName", e.target.value)}
                        placeholder={t("intake.customer_search_placeholder")}
                        type="text"
                        value={form.customerName}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="customer-phone">
                        {t("intake.phone")}
                      </label>
                      <input
                        className={inputCls}
                        id="customer-phone"
                        onChange={(e) =>
                          update("customerPhone", e.target.value)
                        }
                        placeholder="+213..."
                        type="tel"
                        value={form.customerPhone}
                      />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="customer-email">
                        {t("intake.email")}
                      </label>
                      <input
                        className={inputCls}
                        id="customer-email"
                        onChange={(e) =>
                          update("customerEmail", e.target.value)
                        }
                        placeholder="example@email.com"
                        type="email"
                        value={form.customerEmail}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Device */}
              <div className="space-y-6">
                <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                  <span className="material-symbols-outlined text-primary">
                    smartphone
                  </span>
                  {t("intake.device_section")}
                </h2>

                <div className="flex flex-wrap gap-2">
                  {DEVICE_CATEGORIES.map((cat) => (
                    <button
                      className={`rounded-full px-4 py-1.5 font-bold font-label text-xs transition-all ${
                        form.deviceCategory === cat.key
                          ? "bg-primary text-white"
                          : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant"
                      }`}
                      key={cat.key}
                      onClick={() => update("deviceCategory", cat.key)}
                      type="button"
                    >
                      {t(cat.labelKey)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="device-brand">
                      {t("intake.brand_series")}
                    </label>
                    <select
                      className="h-12 w-full appearance-none rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                      id="device-brand"
                      onChange={(e) => update("brand", e.target.value)}
                      value={form.brand}
                    >
                      <option value="">{t("intake.brand_series")}</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="device-model">
                      {t("intake.specific_model")}
                    </label>
                    <input
                      className={inputCls}
                      id="device-model"
                      onChange={(e) => update("model", e.target.value)}
                      placeholder={t("intake.specific_model")}
                      type="text"
                      value={form.model}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="device-color">
                      {t("intake.color_finish")}
                    </label>
                    <input
                      className={inputCls}
                      id="device-color"
                      onChange={(e) => update("color", e.target.value)}
                      placeholder={t("intake.color_placeholder")}
                      type="text"
                      value={form.color}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column (40%) — Technical Spec Sheet */}
            <section className="flex w-full flex-1 flex-col space-y-8 bg-surface-container-lowest p-8 md:w-[40%]">
              <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                <span className="material-symbols-outlined text-primary">
                  assignment
                </span>
                {t("intake.tech_spec_sheet")}
              </h2>

              <div className="flex flex-1 flex-col space-y-6">
                <div>
                  <label className={labelCls} htmlFor="reported-problem">
                    {t("intake.reported_problem")}
                  </label>
                  <textarea
                    className={textareaCls}
                    id="reported-problem"
                    onChange={(e) => update("reportedProblem", e.target.value)}
                    placeholder={t("intake.reported_problem_placeholder")}
                    rows={4}
                    value={form.reportedProblem}
                  />
                </div>

                <div>
                  <label className={labelCls} htmlFor="condition-notes">
                    {t("intake.condition_notes")}
                  </label>
                  <textarea
                    className={textareaCls}
                    id="condition-notes"
                    onChange={(e) => update("conditionNotes", e.target.value)}
                    placeholder={t("intake.condition_notes_placeholder")}
                    rows={2}
                    value={form.conditionNotes}
                  />
                </div>

                {/* Estimated Cost & Deposit — Small Label / Big Value */}
                <div className="grid grid-cols-2 gap-6 py-4">
                  <div>
                    <label
                      className="mb-0.5 block font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-widest"
                      htmlFor="estimated-cost"
                    >
                      {t("intake.estimated_cost")}
                    </label>
                    <div className="flex items-baseline gap-1">
                      <input
                        className="w-24 bg-transparent font-extrabold font-headline text-2xl text-primary focus:ring-0"
                        id="estimated-cost"
                        inputMode="decimal"
                        min="0"
                        onChange={(e) =>
                          update("estimatedCost", e.target.value)
                        }
                        placeholder="0"
                        step="0.01"
                        type="number"
                        value={form.estimatedCost}
                      />
                      <span className="font-bold text-on-surface-variant text-sm">
                        DZD
                      </span>
                    </div>
                  </div>
                  <div>
                    <label
                      className="mb-0.5 block font-bold font-label text-[10px] text-on-surface-variant uppercase tracking-widest"
                      htmlFor="deposit"
                    >
                      {t("intake.required_deposit")}
                    </label>
                    <div className="flex items-baseline gap-1">
                      <input
                        className="w-24 bg-transparent font-extrabold font-headline text-2xl text-on-surface focus:ring-0"
                        id="deposit"
                        inputMode="decimal"
                        min="0"
                        onChange={(e) => update("deposit", e.target.value)}
                        placeholder="0"
                        step="0.01"
                        type="number"
                        value={form.deposit}
                      />
                      <span className="font-bold text-on-surface-variant text-sm">
                        DZD
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="delivery-date">
                      {t("intake.delivery_date")}
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute top-1/2 right-4 -translate-y-1/2 text-outline">
                        calendar_today
                      </span>
                      <input
                        className="h-11 w-full rounded-xl bg-surface-container-low px-4 text-on-surface text-sm transition-all focus:ring-2 focus:ring-primary"
                        id="delivery-date"
                        onChange={(e) =>
                          update("estimatedDelivery", e.target.value)
                        }
                        type="date"
                        value={form.estimatedDelivery}
                      />
                    </div>
                  </div>

                  <div className="flex h-full items-center justify-between pt-4">
                    <label
                      className="font-bold font-label text-on-surface-variant text-xs uppercase tracking-wider"
                      htmlFor="warranty-toggle"
                    >
                      {t("intake.warranty_return")}
                    </label>
                    <button
                      aria-checked={form.isWarrantyReturn}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        form.isWarrantyReturn
                          ? "bg-primary"
                          : "bg-surface-container-highest"
                      }`}
                      id="warranty-toggle"
                      onClick={() =>
                        update("isWarrantyReturn", !form.isWarrantyReturn)
                      }
                      role="switch"
                      type="button"
                    >
                      <span
                        className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          form.isWarrantyReturn
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Photo Upload Zone */}
                <div>
                  <label className={labelCls} htmlFor="photo-upload">
                    {t("intake.photo_documentation")}
                  </label>
                  <button
                    className="group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-outline-variant border-dashed bg-surface-container-low/50 p-6 transition-colors hover:border-primary/50"
                    id="photo-upload"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-3xl text-outline transition-colors group-hover:text-primary">
                      add_a_photo
                    </span>
                    <span className="font-label font-medium text-on-surface-variant text-xs">
                      {t("intake.photo_upload_hint")}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-4 border-white/10 border-t bg-surface-container-high/50 px-8 py-6">
            <button
              className="px-6 py-3 font-bold font-headline text-on-surface-variant text-sm transition-colors hover:text-on-surface"
              onClick={onClose}
              type="button"
            >
              {t("intake.cancel_intake")}
            </button>
            <button
              className="primary-gradient rounded-xl px-8 py-3 font-bold font-headline text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              type="submit"
            >
              {t("intake.create_job")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
