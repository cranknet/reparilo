import { useState } from "react";
import type { CreatedCustomerData } from "@/components/modules/jobs/quick-add-customer";
import QuickAddCustomer from "@/components/modules/jobs/quick-add-customer";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { CustomerSearchResult } from "@/hooks/use-customer-search";
import type { CaptureSource } from "@/hooks/use-native-camera";
import CustomerSearchDropdown from "./customer-search-dropdown";
import PhotoUploadZone from "./photo-upload-zone";
import {
  BRANDS,
  DEVICE_CATEGORIES,
  errorCls,
  type IntakeFormData,
  inputCls,
  inputErrorCls,
  labelCls,
  requiredMarkCls,
} from "./types";

interface Step1Props {
  clearCustomer: () => void;
  errors: Partial<Record<keyof IntakeFormData, string>>;
  form: IntakeFormData;
  handleBlur: (field: keyof IntakeFormData) => void;
  handleNativeCapture: (source: CaptureSource) => Promise<void>;
  handlePhotoRemove: (index: number) => void;
  handlePhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQuickAdd: (data: CreatedCustomerData) => void;
  isSearching: boolean;
  photoError: string | null;
  photoPreviews: { file: File; url: string }[];
  query: string;
  results: CustomerSearchResult[];
  searchError: boolean;
  selectCustomer: (customer: CustomerSearchResult) => void;
  setQuery: (q: string) => void;
  setShowQuickAdd: (v: boolean) => void;
  showQuickAdd: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
  touched: Partial<Record<keyof IntakeFormData, boolean>>;
  update: <K extends keyof IntakeFormData>(
    key: K,
    value: IntakeFormData[K]
  ) => void;
}

function CustomerSearchField({
  clearCustomer,
  errors,
  form,
  handleBlur,
  isSearching,
  query,
  results,
  searchError,
  selectCustomer,
  setQuery,
  setShowQuickAdd,
  t,
  touched,
  update,
}: Pick<
  Step1Props,
  | "clearCustomer"
  | "errors"
  | "form"
  | "handleBlur"
  | "isSearching"
  | "query"
  | "results"
  | "searchError"
  | "selectCustomer"
  | "setQuery"
  | "setShowQuickAdd"
  | "t"
  | "touched"
  | "update"
>) {
  const searchOutsideRef = useClickOutside(() => setSearchFocused(false));
  const [searchFocused, setSearchFocused] = useState(false);
  const showDropdown = searchFocused && query.length >= 2 && !form.customerId;
  const nameError = errors.customerName && touched.customerName;

  return (
    <div className="relative" ref={searchOutsideRef}>
      <label className={labelCls} htmlFor="customer-search">
        {t("intake.customer_search")}
        <span className={requiredMarkCls}>*</span>
      </label>
      <div className="relative">
        <span className="material-symbols-outlined absolute end-4 top-1/2 -translate-y-1/2 text-outline">
          {form.customerId ? "check_circle" : "search"}
        </span>
        <input
          aria-describedby={nameError ? "error-customer-name" : undefined}
          aria-invalid={!!nameError}
          className={nameError ? inputErrorCls : inputCls}
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
              setSearchFocused(false);
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      <CustomerSearchDropdown
        isSearching={isSearching}
        onCreateNew={() => {
          setShowQuickAdd(true);
          setSearchFocused(false);
        }}
        onSelect={(c) => {
          selectCustomer(c);
          setSearchFocused(false);
        }}
        query={query}
        results={results}
        searchError={searchError}
        t={t}
        visible={showDropdown}
      />

      {form.customerId && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary-container px-3 py-1.5">
          <span className="material-symbols-outlined text-on-primary-container text-sm">
            verified
          </span>
          <span className="font-label font-medium text-on-primary-container text-xs">
            {t("intake.customer_linked")}
          </span>
        </div>
      )}

      {nameError && (
        <p className={errorCls} id="error-customer-name">
          {errors.customerName}
        </p>
      )}
    </div>
  );
}

export default function Step1Content(props: Step1Props) {
  const {
    clearCustomer,
    errors,
    form,
    handleBlur,
    handleNativeCapture,
    handlePhotoRemove,
    handlePhotoSelect,
    handleQuickAdd,
    isSearching,
    photoError,
    photoPreviews,
    query,
    results,
    searchError,
    selectCustomer,
    setQuery,
    setShowQuickAdd,
    showQuickAdd,
    t,
    touched,
    update,
  } = props;

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-surface-container-low p-4 md:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold font-headline text-lg text-on-surface">
              <span className="material-symbols-outlined text-primary">
                person
              </span>
              {t("intake.customer_section")}
            </h2>
            <button
              className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1.5 font-bold font-label text-on-secondary-container text-xs transition-colors hover:bg-surface-container-high"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">
                person_add
              </span>
              {t("intake.add_customer")}
            </button>
          </div>

          {showQuickAdd && (
            <QuickAddCustomer
              onAdd={(data) => {
                handleQuickAdd(data);
              }}
              onClose={() => setShowQuickAdd(false)}
            />
          )}

          <div className="space-y-4">
            <CustomerSearchField
              clearCustomer={clearCustomer}
              errors={errors}
              form={form}
              handleBlur={handleBlur}
              isSearching={isSearching}
              query={query}
              results={results}
              searchError={searchError}
              selectCustomer={selectCustomer}
              setQuery={setQuery}
              setShowQuickAdd={setShowQuickAdd}
              t={t}
              touched={touched}
              update={update}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="customer-phone">
                  {t("intake.phone")}
                  <span className={requiredMarkCls}>*</span>
                </label>
                <input
                  aria-describedby={
                    errors.customerPhone && touched.customerPhone
                      ? "error-customer-phone"
                      : undefined
                  }
                  aria-invalid={
                    !!(errors.customerPhone && touched.customerPhone)
                  }
                  className={
                    errors.customerPhone && touched.customerPhone
                      ? inputErrorCls
                      : inputCls
                  }
                  id="customer-phone"
                  onBlur={() => handleBlur("customerPhone")}
                  onChange={(e) => update("customerPhone", e.target.value)}
                  placeholder="+213..."
                  required
                  type="tel"
                  value={form.customerPhone}
                />
                {errors.customerPhone && touched.customerPhone && (
                  <p className={errorCls} id="error-customer-phone">
                    {errors.customerPhone}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls} htmlFor="customer-email">
                  {t("intake.email")}
                </label>
                <input
                  className={inputCls}
                  id="customer-email"
                  onChange={(e) => update("customerEmail", e.target.value)}
                  placeholder="example@email.com"
                  type="email"
                  value={form.customerEmail}
                />
              </div>
            </div>
          </div>
        </div>

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
                className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 font-bold font-label text-xs transition-all ${
                  form.deviceCategory === cat.key
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-variant"
                }`}
                key={cat.key}
                onClick={() => update("deviceCategory", cat.key)}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">
                  {cat.icon}
                </span>
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="device-brand">
                {t("intake.brand")}
              </label>
              <input
                className={inputCls}
                id="device-brand"
                list="brand-suggestions"
                onChange={(e) => update("brand", e.target.value)}
                placeholder={t("intake.brand")}
                type="text"
                value={form.brand}
              />
              <datalist id="brand-suggestions">
                {BRANDS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls} htmlFor="device-model">
                {t("intake.model")}
                <span className={requiredMarkCls}>*</span>
              </label>
              <input
                aria-describedby={
                  errors.model && touched.model ? "error-model" : undefined
                }
                aria-invalid={!!(errors.model && touched.model)}
                className={
                  errors.model && touched.model ? inputErrorCls : inputCls
                }
                id="device-model"
                onBlur={() => handleBlur("model")}
                onChange={(e) => update("model", e.target.value)}
                placeholder={t("intake.model")}
                required
                type="text"
                value={form.model}
              />
              {errors.model && touched.model && (
                <p className={errorCls} id="error-model">
                  {errors.model}
                </p>
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
                onNativeCapture={handleNativeCapture}
                onPhotoRemove={handlePhotoRemove}
                onPhotoSelect={handlePhotoSelect}
                photoCount={form.photos.length}
                photoError={photoError}
                photoPreviews={photoPreviews}
                t={t}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
