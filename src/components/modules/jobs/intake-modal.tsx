import type { RepairCategoryType } from "@shared/constants";
import type { RepairCatalog } from "@shared/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CreatedCustomerData } from "@/components/modules/jobs/quick-add-customer";
import QuickAddCustomer from "@/components/modules/jobs/quick-add-customer";
import RepairServicePicker from "@/components/modules/jobs/repair-service-picker";
import type { CustomerSearchResult } from "@/hooks/use-customer-search";
import { useCustomerSearch } from "@/hooks/use-customer-search";

type DeviceCategory = "phone" | "tablet" | "laptop" | "watch";

interface PhotoPreview {
  file: File;
  url: string;
}

interface IntakeFormData {
  brand: string;
  color: string;
  conditionNotes: string;
  customerEmail: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deposit: string;
  deviceCategory: DeviceCategory;
  estimatedCost: string;
  estimatedDelivery: string;
  isWarrantyReturn: boolean;
  model: string;
  photos: File[];
  repairs: Array<{
    repairId: string;
    repairName: string;
    category: RepairCategoryType;
    price: number;
  }>;
  reportedProblem: string;
}

const MAX_PHOTOS = 5;

interface PhotoUploadZoneProps {
  onPhotoRemove: (index: number) => void;
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  photoCount: number;
  photoPreviews: PhotoPreview[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function PhotoUploadZone({
  onPhotoSelect,
  onPhotoRemove,
  photoCount,
  photoPreviews,
  t,
}: PhotoUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className={labelCls} htmlFor="photo-upload">
        {t("intake.device_photos")}
      </label>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        id="photo-upload"
        multiple
        onChange={onPhotoSelect}
        ref={fileInputRef}
        type="file"
      />
      {photoPreviews.length === 0 && (
        <button
          className="group flex min-h-[44px] w-full cursor-pointer items-center gap-4 rounded-xl bg-surface-container-low px-5 py-4 ring-1 ring-outline-variant transition-all hover:ring-primary/50"
          onClick={() => fileInputRef.current?.click()}
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
            <p className="font-label font-medium text-on-surface-variant text-xs">
              {t("intake.photo_upload_hint")}
            </p>
          </div>
        </button>
      )}
      {photoPreviews.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {photoPreviews.map((photo, idx) => (
              <div
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-outline-variant"
                key={photo.url}
              >
                <img
                  alt={`Device ${idx + 1}`}
                  className="h-full w-full object-cover"
                  height={80}
                  src={photo.url}
                  width={80}
                />
                <button
                  aria-label={t("intake.remove_photo")}
                  className="absolute inset-0 flex items-center justify-center bg-on-surface/50 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onPhotoRemove(idx)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg text-on-primary">
                    close
                  </span>
                </button>
              </div>
            ))}
            {photoCount < MAX_PHOTOS && (
              <button
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl ring-1 ring-dashed ring-outline-variant transition-all hover:bg-surface-container-highest hover:ring-primary/50"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="material-symbols-outlined text-2xl text-on-surface-variant transition-colors hover:text-primary">
                  add_photo_alternate
                </span>
              </button>
            )}
          </div>
          <p className="font-label text-on-surface-variant text-xs">
            {t("intake.photo_count", { current: photoCount, max: MAX_PHOTOS })}
          </p>
        </div>
      )}
    </div>
  );
}

const INITIAL_FORM: IntakeFormData = {
  brand: "",
  color: "",
  conditionNotes: "",
  customerEmail: "",
  customerId: "",
  customerName: "",
  customerPhone: "",
  deposit: "",
  deviceCategory: "phone",
  estimatedCost: "",
  estimatedDelivery: "",
  isWarrantyReturn: false,
  model: "",
  photos: [],
  repairs: [],
  reportedProblem: "",
};

interface IntakeModalProps {
  onClose: () => void;
  onSubmit: (data: IntakeFormData) => Promise<void>;
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

function useClickOutside(ref: React.RefObject<HTMLElement | null>) {
  const handlerRef = useRef<() => void>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handlerRef.current?.();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref]);

  return handlerRef;
}

const labelCls =
  "mb-1.5 ms-1 block font-label text-xs font-bold uppercase tracking-wide text-on-surface-variant";
const inputCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const inputErrorCls =
  "h-12 w-full rounded-xl bg-surface-container-highest px-4 text-on-surface ring-2 ring-error transition-all focus:bg-surface-container-lowest focus:ring-primary";
const textareaCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary";
const textareaErrorCls =
  "w-full resize-none rounded-xl bg-surface-container-low p-4 text-sm text-on-surface ring-2 ring-error transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-primary";
const errorCls = "ms-1 mt-1 font-label text-xs font-medium text-error";
const requiredMarkCls = "ms-0.5 text-error";
const REQUIRED_FIELDS: (keyof IntakeFormData)[] = [
  "customerName",
  "customerPhone",
  "model",
  "reportedProblem",
];

interface SearchDropdownProps {
  isSearching: boolean;
  onCreateNew: () => void;
  onSelect: (c: CustomerSearchResult) => void;
  query: string;
  results: CustomerSearchResult[];
  searchError: boolean;
  t: (key: string) => string;
  visible: boolean;
}

function CustomerSearchDropdown({
  isSearching,
  onCreateNew,
  onSelect,
  query,
  results,
  searchError,
  t,
  visible,
}: SearchDropdownProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-surface-container-lowest shadow-lg ring-1 ring-outline-variant">
      {isSearching && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="material-symbols-outlined animate-spin text-on-surface-variant text-sm">
            progress_activity
          </span>
          <span className="font-label text-on-surface-variant text-xs">
            {t("intake.searching")}
          </span>
        </div>
      )}
      {searchError && (
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="material-symbols-outlined text-error text-sm">
            error
          </span>
          <span className="font-label text-error text-xs">
            {t("intake.error_create_customer")}
          </span>
        </div>
      )}
      {!isSearching && results.length > 0 && !searchError && (
        <ul className="max-h-48 overflow-y-auto py-1">
          {results.map((c) => (
            <li key={c.id}>
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-surface-container-high"
                onClick={() => onSelect(c)}
                type="button"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container">
                  <span className="material-symbols-outlined text-on-primary-container text-sm">
                    person
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold font-headline text-on-surface text-sm">
                    {c.name}
                  </p>
                  <p className="truncate font-label text-on-surface-variant text-xs">
                    {c.phone}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isSearching &&
        results.length === 0 &&
        !searchError &&
        query.length >= 2 && (
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="material-symbols-outlined text-on-surface-variant text-sm">
              person_add
            </span>
            <span className="font-label text-on-surface-variant text-xs">
              {t("intake.no_customer_found")}
            </span>
            <button
              className="ms-auto font-bold font-headline text-primary text-xs hover:underline"
              onClick={onCreateNew}
              type="button"
            >
              {t("intake.create_new")}
            </button>
          </div>
        )}
    </div>
  );
}

function useRepairHandlers(
  setForm: React.Dispatch<React.SetStateAction<IntakeFormData>>
) {
  const handleSelectRepair = useCallback(
    (repair: RepairCatalog) => {
      setForm((prev) => ({
        ...prev,
        repairs: [
          ...prev.repairs,
          {
            repairId: repair.id,
            repairName: repair.name,
            category: repair.category,
            price: Number(repair.defaultPrice),
          },
        ],
      }));
    },
    [setForm]
  );

  const handleRemoveRepair = useCallback(
    (index: number) => {
      setForm((prev) => ({
        ...prev,
        repairs: prev.repairs.filter((_, i) => i !== index),
      }));
    },
    [setForm]
  );

  const handleRepairPriceChange = useCallback(
    (index: number, newPrice: number) => {
      setForm((prev) => ({
        ...prev,
        repairs: prev.repairs.map((r, i) =>
          i === index ? { ...r, price: Number(newPrice) || 0 } : r
        ),
      }));
    },
    [setForm]
  );

  return { handleSelectRepair, handleRemoveRepair, handleRepairPriceChange };
}

interface RepairServicesSectionProps {
  onPriceChange: (index: number, price: number) => void;
  onRemove: (index: number) => void;
  onSelect: (repair: RepairCatalog) => void;
  repairs: IntakeFormData["repairs"];
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function RepairServicesSection({
  onPriceChange,
  onRemove,
  onSelect,
  repairs,
  t,
}: RepairServicesSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold font-headline text-on-surface text-sm">
          <span className="material-symbols-outlined text-primary text-sm">
            build
          </span>
          {t("intake.repair_services")}
        </span>
        {repairs.length > 0 && (
          <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-bold font-label text-on-primary-fixed text-xs">
            {t("intake.repair_services_count", { count: repairs.length })}
          </span>
        )}
      </div>

      <RepairServicePicker
        compact
        onSelect={onSelect}
        selectedIds={repairs.map((r) => r.repairId)}
      />

      {repairs.length > 0 && (
        <div className="space-y-1.5">
          {repairs.map((repair, idx) => (
            <div
              className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2"
              key={repair.repairId}
            >
              <div className="min-w-0 flex-1">
                <p className="font-body font-medium text-on-surface text-sm">
                  {repair.repairName}
                </p>
                <p className="font-label text-on-surface-variant text-xs">
                  {t(`repair_category.${repair.category}`)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  className="w-20 rounded-lg bg-surface-container-lowest px-2 py-1 text-end font-body text-on-surface text-xs outline-none focus:ring-1 focus:ring-primary/20"
                  min="0"
                  onChange={(e) => onPriceChange(idx, Number(e.target.value))}
                  step="0.01"
                  type="number"
                  value={repair.price}
                />
                <span className="font-label text-on-surface-variant text-xs">
                  {t("currency_dzd")}
                </span>
              </div>
              <button
                className="flex h-6 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                onClick={() => onRemove(idx)}
                title={t("intake.remove_repair")}
                type="button"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const {
    isSearching,
    query,
    results,
    searchError,
    setQuery,
    clear: clearSearch,
  } = useCustomerSearch();

  const [photoPreviews, setPhotoPreviews] = useState<PhotoPreview[]>([]);

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof IntakeFormData, string>> = {};
    if (!form.customerName.trim()) {
      newErrors.customerName = t("intake.error_required");
    }
    if (!form.customerPhone.trim()) {
      newErrors.customerPhone = t("intake.error_required");
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
      if (REQUIRED_FIELDS.includes(field) && !form[field]?.toString().trim()) {
        setErrors((prev) => ({ ...prev, [field]: t("intake.error_required") }));
      }
    },
    [form, t]
  );

  const selectCustomer = useCallback(
    (customer: CustomerSearchResult) => {
      setForm((prev) => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email ?? "",
      }));
      clearSearch();
      setSearchFocused(false);
    },
    [clearSearch]
  );

  const clearCustomer = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      customerId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
    }));
    clearSearch();
  }, [clearSearch]);

  const handleQuickAdd = useCallback((data: CreatedCustomerData) => {
    setForm((prev) => ({
      ...prev,
      customerId: data.id,
      customerName: data.name,
      customerPhone: data.phone,
      customerEmail: data.email,
    }));
    setShowQuickAdd(false);
  }, []);

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const remaining = MAX_PHOTOS - form.photos.length;
      const toAdd = files.slice(0, remaining);
      if (toAdd.length === 0) {
        return;
      }
      const newPreviews: PhotoPreview[] = toAdd.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
      }));
      setPhotoPreviews((prev) => [...prev, ...newPreviews]);
      setForm((prev) => ({ ...prev, photos: [...prev.photos, ...toAdd] }));
      e.target.value = "";
    },
    [form.photos.length]
  );

  const handlePhotoRemove = useCallback(
    (index: number) => {
      URL.revokeObjectURL(photoPreviews[index].url);
      setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
      setForm((prev) => ({
        ...prev,
        photos: prev.photos.filter((_, i) => i !== index),
      }));
    },
    [photoPreviews]
  );

  const { handleSelectRepair, handleRemoveRepair, handleRepairPriceChange } =
    useRepairHandlers(setForm);

  const computedEstCost = form.repairs.reduce((s, r) => s + r.price, 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const outsideRef = useClickOutside(searchRef);
  outsideRef.current = () => setSearchFocused(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched({
        customerName: true,
        customerPhone: true,
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
      for (const p of photoPreviews) {
        URL.revokeObjectURL(p.url);
      }
      setPhotoPreviews([]);
      onClose();
    },
    [form, onSubmit, onClose, validate, photoPreviews]
  );

  if (!open) {
    return null;
  }

  const showDropdown = searchFocused && query.length >= 2 && !form.customerId;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-2 py-20 lg:p-4"
      role="dialog"
    >
      <button
        aria-label={t("close_modal")}
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
                  {t("intake.error_summary")}
                </p>
              </div>
            )}
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between bg-surface-container-low px-4 py-4 md:px-8 md:py-6">
            <div className="flex items-center gap-4">
              <h1 className="font-bold font-headline text-lg text-on-surface tracking-tight md:text-2xl">
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
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
            {/* Left Column (60%) — Customer & Device */}
            <section className="w-full space-y-6 bg-surface-container-low p-4 md:w-[60%] md:space-y-8 md:p-8">
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
                    {t("intake.add_customer")}
                  </button>
                </div>

                {showQuickAdd && (
                  <QuickAddCustomer
                    onAdd={handleQuickAdd}
                    onClose={() => setShowQuickAdd(false)}
                  />
                )}

                <div className="space-y-4">
                  <div className="relative" ref={searchRef}>
                    <label className={labelCls} htmlFor="customer-search">
                      {t("intake.customer_search")}
                      <span className={requiredMarkCls}>*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute end-4 top-1/2 -translate-y-1/2 text-outline">
                        {form.customerId ? "check_circle" : "search"}
                      </span>
                      <input
                        aria-invalid={!!errors.customerName}
                        className={
                          errors.customerName ? inputErrorCls : inputCls
                        }
                        id="customer-search"
                        onBlur={() => handleBlur("customerName")}
                        onChange={(e) => {
                          const val = e.target.value;
                          update("customerId", "");
                          update("customerName", val);
                          setQuery(val);
                        }}
                        onFocus={() => setSearchFocused(true)}
                        placeholder={t("intake.customer_search_placeholder")}
                        required
                        type="text"
                        value={form.customerName}
                      />
                      {form.customerId && (
                        <button
                          aria-label={t("intake.clear_customer")}
                          className="absolute end-12 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface"
                          onClick={() => {
                            clearCustomer();
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">
                            close
                          </span>
                        </button>
                      )}
                    </div>

                    <CustomerSearchDropdown
                      isSearching={isSearching}
                      onCreateNew={() => {
                        setShowQuickAdd(true);
                        setSearchFocused(false);
                      }}
                      onSelect={selectCustomer}
                      query={query}
                      results={results}
                      searchError={searchError}
                      t={t}
                      visible={showDropdown}
                    />

                    {form.customerId && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                        <span className="material-symbols-outlined text-primary text-sm">
                          verified
                        </span>
                        <span className="font-label font-medium text-primary text-xs">
                          {t("intake.customer_linked")}
                        </span>
                      </div>
                    )}

                    {errors.customerName && touched.customerName && (
                      <p className={errorCls}>{errors.customerName}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="customer-phone">
                        {t("intake.phone")}
                        <span className={requiredMarkCls}>*</span>
                      </label>
                      <input
                        aria-invalid={!!errors.customerPhone}
                        className={
                          errors.customerPhone ? inputErrorCls : inputCls
                        }
                        id="customer-phone"
                        onBlur={() => handleBlur("customerPhone")}
                        onChange={(e) =>
                          update("customerPhone", e.target.value)
                        }
                        placeholder="+213..."
                        required
                        type="tel"
                        value={form.customerPhone}
                      />
                      {errors.customerPhone && touched.customerPhone && (
                        <p className={errorCls}>{errors.customerPhone}</p>
                      )}
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
                      {t("intake.brand")}
                    </label>
                    <select
                      className="h-12 w-full appearance-none rounded-xl bg-surface-container-highest px-4 text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                      id="device-brand"
                      onChange={(e) => update("brand", e.target.value)}
                      value={form.brand}
                    >
                      <option value="">{t("intake.brand")}</option>
                      {BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="device-model">
                      {t("intake.model")}
                      <span className={requiredMarkCls}>*</span>
                    </label>
                    <input
                      aria-invalid={!!errors.model}
                      className={errors.model ? inputErrorCls : inputCls}
                      id="device-model"
                      onBlur={() => handleBlur("model")}
                      onChange={(e) => update("model", e.target.value)}
                      placeholder={t("intake.model")}
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
                      {t("intake.device_color")}
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
                  <div className="sm:col-span-2">
                    <PhotoUploadZone
                      onPhotoRemove={handlePhotoRemove}
                      onPhotoSelect={handlePhotoSelect}
                      photoCount={form.photos.length}
                      photoPreviews={photoPreviews}
                      t={t}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Right Column (40%) — Technical Spec Sheet */}
            <section className="flex w-full flex-1 flex-col space-y-6 bg-surface-container-lowest p-4 md:w-[40%] md:space-y-8 md:p-8">
              <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
                <span className="material-symbols-outlined text-primary">
                  assignment
                </span>
                {t("intake.repair_details")}
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

                <RepairServicesSection
                  onPriceChange={handleRepairPriceChange}
                  onRemove={handleRemoveRepair}
                  onSelect={handleSelectRepair}
                  repairs={form.repairs}
                  t={t}
                />

                {/* Estimated Cost & Deposit — Small Label / Big Value */}
                <div className="grid grid-cols-2 gap-6 py-4">
                  <div>
                    <label
                      className="mb-0.5 block font-bold font-label text-on-surface-variant text-xs uppercase tracking-wide"
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
                        placeholder={String(computedEstCost)}
                        step="0.01"
                        type="number"
                        value={form.estimatedCost}
                      />
                      <span className="font-bold text-on-surface-variant text-sm">
                        {t("currency_dzd")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label
                      className="mb-0.5 block font-bold font-label text-on-surface-variant text-xs uppercase tracking-wide"
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
                        {t("currency_dzd")}
                      </span>
                    </div>
                  </div>
                </div>

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
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className="flex shrink-0 items-center justify-end gap-4 border-outline-variant border-t bg-surface-container-high px-4 py-4 md:px-8 md:py-6">
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
              {isSubmitting
                ? t("intake.creating_job")
                : t("intake.start_repair")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
