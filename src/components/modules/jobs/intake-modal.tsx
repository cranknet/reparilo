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
  "mb-1.5 ms-1 block font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant";
const inputCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const inputErrorCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface ring-2 ring-error transition-all focus:bg-surface-container-lowest focus:ring-primary";
const textareaCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const textareaErrorCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface ring-2 ring-error transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-primary";
const errorCls = "ms-1 mt-1 font-label text-[11px] font-medium text-error";
const requiredMarkCls = "ms-0.5 text-error";

export default function IntakeModal({
  onClose,
  onSubmit,
  open,
}: IntakeModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<IntakeFormData>(INITIAL_FORM);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof IntakeFormData, string>>
  >({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof IntakeFormData, boolean>>
  >({});

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof IntakeFormData, string>> = {};
    if (!form.customerName.trim()) {
      newErrors.customerName = t("intake.error_required");
    }
    if (!form.model.trim()) {
      newErrors.model = t("intake.error_required");
    }
    if (!form.reportedProblem.trim()) {
      newErrors.reportedProblem = t("intake.error_required");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, t]);

  const update = useCallback(
    <K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [errors]
  );

  const handleBlur = useCallback(
    (field: keyof IntakeFormData) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      if (
        (field === "customerName" ||
          field === "model" ||
          field === "reportedProblem") &&
        !form[field]?.toString().trim()
      ) {
        setErrors((prev) => ({ ...prev, [field]: t("intake.error_required") }));
      }
    },
    [form, t]
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
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({
        customerName: true,
        model: true,
        reportedProblem: true,
      });
      if (!validate()) {
        return;
      }
      setIsSubmitting(true);
      try {
        await onSubmit(form);
      } catch {
        setIsSubmitting(false);
        return;
      }
      setForm(INITIAL_FORM);
      setTouched({});
      setIsSubmitting(false);
      onClose();
    },
    [form, onSubmit, onClose, validate]
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
        className="absolute inset-0 bg-on-surface/40"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 mx-4 flex w-full max-w-[960px] flex-col overflow-hidden rounded-xl shadow-2xl sm:mx-6">
        <form onSubmit={handleSubmit}>
          {Object.keys(errors).length > 0 &&
            Object.values(touched).some(Boolean) && (
              <div className="flex items-center gap-3 bg-error-container px-8 py-3">
                <span className="material-symbols-outlined text-on-error-container">
                  error
                </span>
                <p className="font-bold font-label text-[11px] text-on-error-container">
                  {t("intake.error_summary")}
                </p>
              </div>
            )}
          {/* Header */}
          <header className="flex items-center justify-between bg-surface-container-low px-8 py-6">
            <div className="flex items-center gap-4">
              <h1 className="font-bold font-headline text-2xl text-on-surface tracking-tight">
                {t("intake.title")}
              </h1>
              <span className="rounded-full bg-primary-fixed px-3 py-1 font-bold font-headline text-on-primary-fixed text-xs uppercase tracking-widest">
                {t("intake.job_code")}
              </span>
            </div>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high"
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
                      <span className={requiredMarkCls}>*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute end-4 top-1/2 -translate-y-1/2 text-outline">
                        search
                      </span>
                      <input
                        aria-invalid={!!errors.customerName}
                        className={
                          errors.customerName ? inputErrorCls : inputCls
                        }
                        id="customer-search"
                        onBlur={() => handleBlur("customerName")}
                        onChange={(e) => update("customerName", e.target.value)}
                        placeholder={t("intake.customer_search_placeholder")}
                        required
                        type="text"
                        value={form.customerName}
                      />
                    </div>
                    {errors.customerName && touched.customerName && (
                      <p className={errorCls}>{errors.customerName}</p>
                    )}
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
                      className={`min-h-[44px] rounded-full px-4 py-2 font-bold font-label text-xs transition-all ${
                        form.deviceCategory === cat.key
                          ? "bg-primary text-on-primary"
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
                      <span className={requiredMarkCls}>*</span>
                    </label>
                    <input
                      aria-invalid={!!errors.model}
                      className={errors.model ? inputErrorCls : inputCls}
                      id="device-model"
                      onBlur={() => handleBlur("model")}
                      onChange={(e) => update("model", e.target.value)}
                      placeholder={t("intake.specific_model")}
                      required
                      type="text"
                      value={form.model}
                    />
                    {errors.model && touched.model && (
                      <p className={errorCls}>{errors.model}</p>
                    )}
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
                    <span className={requiredMarkCls}>*</span>
                  </label>
                  <textarea
                    aria-invalid={!!errors.reportedProblem}
                    className={
                      errors.reportedProblem ? textareaErrorCls : textareaCls
                    }
                    id="reported-problem"
                    onBlur={() => handleBlur("reportedProblem")}
                    onChange={(e) => update("reportedProblem", e.target.value)}
                    placeholder={t("intake.reported_problem_placeholder")}
                    required
                    rows={4}
                    value={form.reportedProblem}
                  />
                  {errors.reportedProblem && touched.reportedProblem && (
                    <p className={errorCls}>{errors.reportedProblem}</p>
                  )}
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
                      className="mb-0.5 block font-bold font-label text-[11px] text-on-surface-variant uppercase tracking-widest"
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
                      className="mb-0.5 block font-bold font-label text-[11px] text-on-surface-variant uppercase tracking-widest"
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
                      <span className="material-symbols-outlined absolute end-4 top-1/2 -translate-y-1/2 text-outline">
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
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-label font-semibold text-xs ${form.isWarrantyReturn ? "text-primary" : "text-on-surface-variant"}`}
                      >
                        {form.isWarrantyReturn
                          ? t("intake.warranty_yes")
                          : t("intake.warranty_no")}
                      </span>
                      <button
                        aria-checked={form.isWarrantyReturn}
                        className={`relative min-h-[44px] min-w-[44px] rounded-full p-4 transition-colors ${
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
                          className={`absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition-[inset-inline-start] ${
                            form.isWarrantyReturn
                              ? "start-[22px]"
                              : "start-[2px]"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Photo Upload Zone */}
                <div>
                  <label className={labelCls} htmlFor="photo-upload">
                    {t("intake.photo_documentation")}
                  </label>
                  <button
                    className="group flex min-h-[44px] w-full cursor-pointer items-center gap-4 rounded-xl bg-surface-container-low px-5 py-4 ring-1 ring-outline-variant transition-all hover:ring-primary/50"
                    id="photo-upload"
                    type="button"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl transition-colors group-hover:text-primary">
                        add_a_photo
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold font-headline text-on-surface text-sm">
                        {t("intake.photo_upload_title")}
                      </p>
                      <p className="font-label font-medium text-[11px] text-on-surface-variant">
                        {t("intake.photo_upload_hint")}
                      </p>
                    </div>
                    <span className="ms-auto rounded-full bg-primary-fixed px-2.5 py-1 font-bold font-label text-[11px] text-on-primary-fixed">
                      0 {t("intake.photo_count_label")}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-4 border-outline-variant border-t bg-surface-container-high px-8 py-6">
            <button
              className="px-6 py-3 font-bold font-headline text-on-surface-variant text-sm transition-colors hover:text-on-surface"
              onClick={onClose}
              type="button"
            >
              {t("intake.cancel_intake")}
            </button>
            <button
              className="rounded-xl bg-primary px-8 py-3 font-bold font-headline text-on-primary text-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? t("intake.creating_job") : t("intake.create_job")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
