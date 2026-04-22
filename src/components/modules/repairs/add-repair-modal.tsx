import type { RepairCatalog } from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RepairCategory } from "./repair-table";

export interface RepairFormData {
  basePrice: string;
  category: RepairCategory;
  description: string;
  duration: string;
  name: string;
}

const INITIAL_FORM: RepairFormData = {
  basePrice: "",
  category: "HARDWARE",
  description: "",
  duration: "",
  name: "",
};

interface AddRepairModalProps {
  editingRepair?: RepairCatalog | null;
  onClose: () => void;
  onSubmit: (data: RepairFormData) => Promise<void>;
  open: boolean;
}

const REPAIR_CATEGORIES: {
  icon: string;
  key: RepairCategory;
  labelKey: string;
}[] = [
  {
    icon: "build",
    key: "HARDWARE",
    labelKey: "repair_category.HARDWARE",
  },
  {
    icon: "terminal",
    key: "SOFTWARE",
    labelKey: "repair_category.SOFTWARE",
  },
  {
    icon: "troubleshoot",
    key: "DIAGNOSTIC",
    labelKey: "repair_category.DIAGNOSTIC",
  },
];

const labelCls =
  "mb-1.5 ms-1 block font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant";
const inputCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const inputErrorCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface ring-2 ring-error transition-all focus:bg-surface-container-lowest focus:ring-primary";
const textareaCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const errorCls = "ms-1 mt-1 font-label text-xs font-medium text-error";
const requiredMarkCls = "ms-0.5 text-error";

export default function AddRepairModal({
  editingRepair,
  onClose,
  onSubmit,
  open,
}: AddRepairModalProps) {
  const { t } = useTranslation();
  const isEditing = !!editingRepair;
  const [form, setForm] = useState<RepairFormData>(() => {
    if (editingRepair) {
      return {
        name: editingRepair.name,
        category: editingRepair.category as RepairCategory,
        basePrice: String(editingRepair.defaultPrice),
        description: "",
        duration: "",
      };
    }
    return INITIAL_FORM;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof RepairFormData, string>>
  >({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof RepairFormData, boolean>>
  >({});

  function validate(): boolean {
    const newErrors: Partial<Record<keyof RepairFormData, string>> = {};
    if (!form.name.trim()) {
      newErrors.name = t("repair_modal.error_required");
    }
    if (!form.basePrice.trim()) {
      newErrors.basePrice = t("repair_modal.error_required");
    }
    if (!form.duration.trim()) {
      newErrors.duration = t("repair_modal.error_required");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const update = useCallback(
    <K extends keyof RepairFormData>(key: K, value: RepairFormData[K]) => {
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
    (field: keyof RepairFormData) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      if (
        (field === "name" || field === "basePrice" || field === "duration") &&
        !form[field]?.toString().trim()
      ) {
        setErrors((prev) => ({
          ...prev,
          [field]: t("repair_modal.error_required"),
        }));
      }
    },
    [form, t]
  );

  useEffect(() => {
    if (editingRepair) {
      setForm({
        name: editingRepair.name,
        category: editingRepair.category as RepairCategory,
        basePrice: String(editingRepair.defaultPrice),
        description: "",
        duration: "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
    setTouched({});
  }, [editingRepair]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, basePrice: true, duration: true });
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
    setErrors({});
    setIsSubmitting(false);
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-2 py-20 lg:p-4"
      role="dialog"
    >
      <button
        aria-label={t("repair_modal.close")}
        className="absolute inset-0 bg-on-surface/40"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 flex max-h-full w-full max-w-[960px] flex-col overflow-hidden rounded-xl shadow-2xl">
        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={handleSubmit}
        >
          {Object.keys(errors).length > 0 &&
            Object.values(touched).some(Boolean) && (
              <div className="flex items-center gap-3 bg-error-container px-4 py-3 md:px-8">
                <span className="material-symbols-outlined text-on-error-container">
                  error
                </span>
                <p className="font-bold font-label text-on-error-container text-xs">
                  {t("repair_modal.error_summary")}
                </p>
              </div>
            )}

          <header className="flex shrink-0 items-center justify-between bg-surface-container-low px-4 py-4 md:px-8 md:py-6">
            <div className="flex items-center gap-4">
              <h1 className="font-bold font-headline text-lg text-on-surface tracking-tight md:text-2xl">
                {isEditing ? t("edit") : t("repair_modal.title")}
              </h1>
            </div>
            <button
              aria-label={t("close")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
            <section className="w-full space-y-6 bg-surface-container-low p-4 md:w-[60%] md:space-y-8 md:p-8">
              <div className="space-y-6">
                <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                  <span className="material-symbols-outlined text-primary">
                    category
                  </span>
                  {t("repair_modal.category_section")}
                </h2>

                <div className="flex flex-wrap gap-2">
                  {REPAIR_CATEGORIES.map((cat) => (
                    <button
                      className={`min-h-[44px] rounded-full px-4 py-2 font-bold font-label text-xs transition-all ${
                        form.category === cat.key
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant"
                      }`}
                      key={cat.key}
                      onClick={() => update("category", cat.key)}
                      type="button"
                    >
                      <span className="material-symbols-outlined me-1 align-middle text-sm">
                        {cat.icon}
                      </span>
                      {t(cat.labelKey)}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="repair-name">
                      {t("repair_modal.service_name")}
                      <span className={requiredMarkCls}>*</span>
                    </label>
                    <input
                      aria-invalid={!!errors.name}
                      className={errors.name ? inputErrorCls : inputCls}
                      id="repair-name"
                      onBlur={() => handleBlur("name")}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder={t("repair_modal.service_name_placeholder")}
                      required
                      type="text"
                      value={form.name}
                    />
                    {errors.name && touched.name && (
                      <p className={errorCls}>{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls} htmlFor="repair-description">
                      {t("repair_modal.description")}
                    </label>
                    <textarea
                      className={textareaCls}
                      id="repair-description"
                      onChange={(e) => update("description", e.target.value)}
                      placeholder={t("repair_modal.description_placeholder")}
                      rows={3}
                      value={form.description}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="flex w-full flex-1 flex-col space-y-6 bg-surface-container-lowest p-4 md:w-[40%] md:space-y-8 md:p-8">
              <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                <span className="material-symbols-outlined text-primary">
                  payments
                </span>
                {t("repair_modal.pricing_section")}
              </h2>

              <div className="flex flex-1 flex-col space-y-6">
                <div>
                  <label
                    className="mb-0.5 block font-bold font-label text-on-surface-variant text-xs uppercase tracking-wide"
                    htmlFor="repair-price"
                  >
                    {t("repair_modal.base_price")}
                    <span className={requiredMarkCls}>*</span>
                  </label>
                  <div className="flex items-baseline gap-1">
                    <input
                      aria-invalid={!!errors.basePrice}
                      className={`w-24 bg-transparent font-extrabold font-headline text-2xl focus:ring-0 ${
                        errors.basePrice
                          ? "text-error ring-2 ring-error"
                          : "text-primary"
                      }`}
                      id="repair-price"
                      inputMode="decimal"
                      min="0"
                      onBlur={() => handleBlur("basePrice")}
                      onChange={(e) => update("basePrice", e.target.value)}
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={form.basePrice}
                    />
                    <span className="font-bold text-on-surface-variant text-sm">
                      {t("currency_dzd")}
                    </span>
                  </div>
                  {errors.basePrice && touched.basePrice && (
                    <p className={errorCls}>{errors.basePrice}</p>
                  )}
                </div>

                <div>
                  <label className={labelCls} htmlFor="repair-duration">
                    {t("repair_modal.estimated_duration")}
                    <span className={requiredMarkCls}>*</span>
                  </label>
                  <input
                    aria-invalid={!!errors.duration}
                    className={errors.duration ? inputErrorCls : inputCls}
                    id="repair-duration"
                    onBlur={() => handleBlur("duration")}
                    onChange={(e) => update("duration", e.target.value)}
                    placeholder={t("repair_modal.duration_placeholder")}
                    required
                    type="text"
                    value={form.duration}
                  />
                  {errors.duration && touched.duration && (
                    <p className={errorCls}>{errors.duration}</p>
                  )}
                </div>

                <div className="rounded-lg bg-surface-container-low/50 p-3 text-on-surface-variant text-xs leading-relaxed">
                  <span className="font-bold text-primary italic">
                    {t("note")}:
                  </span>{" "}
                  {t("repair_modal.pricing_note")}
                </div>
              </div>
            </section>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-4 bg-surface-container-high px-4 py-4 md:px-8 md:py-6">
            <button
              className="px-6 py-3 font-bold font-headline text-on-surface-variant text-sm transition-colors hover:text-on-surface"
              onClick={onClose}
              type="button"
            >
              {t("repair_modal.cancel")}
            </button>
            <button
              className="rounded-xl bg-primary px-8 py-3 font-bold font-headline text-on-primary text-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting && isEditing && t("repair_modal.saving")}
              {isSubmitting && !isEditing && t("repair_modal.creating")}
              {!isSubmitting && isEditing && t("save")}
              {!(isSubmitting || isEditing) && t("repair_modal.create_service")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
