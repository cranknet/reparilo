import type { PartCategoryType } from "@shared/constants";
import { PartCategory } from "@shared/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useModalEffects } from "@/hooks/use-modal-effects";

interface AddPartFormData {
  category: PartCategoryType | "";
  defaultPrice: string;
  isActive: boolean;
  name: string;
  supplier: string;
}

interface AddPartModalProps {
  onClose: () => void;
  onSubmit: (
    data: Omit<AddPartFormData, "defaultPrice"> & { defaultPrice: number }
  ) => void;
}

const CATEGORIES: PartCategoryType[] = Object.values(PartCategory);
const PRICE_REGEX = /^\d*\.?\d{0,2}$/;

const INITIAL_FORM: AddPartFormData = {
  name: "",
  category: "",
  defaultPrice: "",
  supplier: "",
  isActive: true,
};

function isDirty(form: AddPartFormData): boolean {
  return (
    form.name !== INITIAL_FORM.name ||
    form.category !== INITIAL_FORM.category ||
    form.defaultPrice !== INITIAL_FORM.defaultPrice ||
    form.supplier !== INITIAL_FORM.supplier ||
    form.isActive !== INITIAL_FORM.isActive
  );
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function trapTabInContainer(e: KeyboardEvent, container: HTMLElement) {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1) ?? focusable[0];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function focusFirstIn(container: HTMLElement) {
  container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
}

export default function AddPartModal({ onClose, onSubmit }: AddPartModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  useModalEffects(true, onClose, dialogRef);

  const [form, setForm] = useState<AddPartFormData>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "category" | "defaultPrice", string>>
  >({});
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    if (!(showConfirmClose && confirmDialogRef.current)) {
      return;
    }
    const handleConfirmKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        setShowConfirmClose(false);
        return;
      }
      if (e.key === "Tab" && confirmDialogRef.current) {
        trapTabInContainer(e, confirmDialogRef.current);
      }
    };
    document.addEventListener("keydown", handleConfirmKeyDown, true);
    focusFirstIn(confirmDialogRef.current);
    return () => {
      document.removeEventListener("keydown", handleConfirmKeyDown, true);
    };
  }, [showConfirmClose]);

  const update = useCallback(
    <K extends keyof AddPartFormData>(key: K, value: AddPartFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (key === "name" && value.toString().trim()) {
        setErrors((prev) => ({ ...prev, name: undefined }));
      }
      if (key === "category" && value) {
        setErrors((prev) => ({ ...prev, category: undefined }));
      }
      if (
        key === "defaultPrice" &&
        value &&
        Number.parseFloat(String(value)) > 0
      ) {
        setErrors((prev) => ({ ...prev, defaultPrice: undefined }));
      }
    },
    []
  );

  const handleRequestClose = useCallback(() => {
    if (isDirty(form)) {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  }, [form, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<
      Record<"name" | "category" | "defaultPrice", string>
    > = {};
    if (!form.name.trim()) {
      newErrors.name = t("add_part_modal.error_name_required");
    }
    if (!form.category) {
      newErrors.category = t("add_part_modal.error_category_required");
    }
    const priceVal = Number.parseFloat(form.defaultPrice);
    if (!form.defaultPrice || Number.isNaN(priceVal) || priceVal <= 0) {
      newErrors.defaultPrice = t("add_part_modal.error_price_invalid");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit({
      name: form.name,
      category: form.category as PartCategoryType,
      defaultPrice: priceVal,
      supplier: form.supplier,
      isActive: form.isActive,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-hidden="true"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-[20px]"
        onClick={handleRequestClose}
        tabIndex={-1}
        type="button"
      />
      {showConfirmClose && (
        <div
          aria-describedby="confirm-close-desc"
          aria-labelledby="confirm-close-title"
          aria-modal="true"
          className="relative z-[60] mx-4 w-full max-w-[360px] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl"
          ref={confirmDialogRef}
          role="alertdialog"
        >
          <div className="px-6 py-6">
            <h3
              className="font-bold font-headline text-lg text-on-surface"
              id="confirm-close-title"
            >
              {t("add_part_modal.discard_title")}
            </h3>
            <p
              className="mt-2 text-on-surface-variant text-sm"
              id="confirm-close-desc"
            >
              {t("add_part_modal.discard_desc")}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button
              onClick={() => setShowConfirmClose(false)}
              type="button"
              variant="ghost"
            >
              {t("add_part_modal.keep_editing")}
            </Button>
            <Button onClick={onClose} type="button" variant="destructive">
              {t("add_part_modal.discard")}
            </Button>
          </div>
        </div>
      )}
      <div
        aria-labelledby="add-part-modal-title"
        aria-modal="true"
        className="relative z-10 mx-4 max-h-[90dvh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl"
        id="add-part-modal"
        ref={dialogRef}
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-container-low px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="font-bold font-headline text-on-surface text-xl tracking-tight"
                  id="add-part-modal-title"
                >
                  {t("add_part_modal.title")}
                </h2>
                <p className="mt-0.5 text-on-surface-variant text-sm">
                  {t("add_part_modal.subtitle")}
                </p>
              </div>
              <button
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={handleRequestClose}
                type="button"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            <div>
              <Label className="mb-2 block" htmlFor="part-name">
                {t("add_part_modal.part_name")}
              </Label>
              <Input
                aria-describedby={errors.name ? "error-part-name" : undefined}
                aria-invalid={!!errors.name || undefined}
                autoComplete="off"
                id="part-name"
                onChange={(e) => update("name", e.target.value)}
                placeholder={t("add_part_modal.part_name_placeholder")}
                required
                value={form.name}
              />
              {errors.name && (
                <p
                  className="mt-1.5 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs"
                  id="error-part-name"
                  role="alert"
                >
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block" htmlFor="part-category">
                {t("add_part_modal.category")}
              </Label>
              <div className="relative">
                <Select
                  aria-describedby={
                    errors.category ? "error-part-category" : undefined
                  }
                  aria-invalid={!!errors.category || undefined}
                  id="part-category"
                  onChange={(e) =>
                    update("category", e.target.value as PartCategoryType)
                  }
                  required
                  value={form.category}
                >
                  <option disabled value="">
                    {t("add_part_modal.category_placeholder")}
                  </option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`part_category.${cat}`)}
                    </option>
                  ))}
                </Select>
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
                  <Icon name="expand_more" size="sm" />
                </span>
              </div>
              {errors.category && (
                <p
                  className="mt-1.5 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs"
                  id="error-part-category"
                  role="alert"
                >
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block" htmlFor="part-price">
                {t("add_part_modal.default_price")}
              </Label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">
                  {t("currency_dzd")}
                </span>
                <Input
                  aria-describedby={
                    errors.defaultPrice ? "error-part-price" : undefined
                  }
                  aria-invalid={!!errors.defaultPrice || undefined}
                  autoComplete="off"
                  className="ps-10 font-mono"
                  id="part-price"
                  min="0"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || PRICE_REGEX.test(val)) {
                      update("defaultPrice", val);
                    }
                  }}
                  placeholder="0"
                  required
                  step="0.01"
                  type="number"
                  value={form.defaultPrice}
                />
                {errors.defaultPrice && (
                  <p
                    className="mt-1.5 rounded-lg bg-error-container px-3 py-1.5 font-bold text-on-error-container text-xs"
                    id="error-part-price"
                    role="alert"
                  >
                    {errors.defaultPrice}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2 block" htmlFor="part-supplier">
                {t("add_part_modal.supplier")}{" "}
                <span className="font-normal text-on-surface-variant text-xs normal-case tracking-normal">
                  ({t("add_part_modal.optional")})
                </span>
              </Label>
              <Input
                autoComplete="off"
                id="part-supplier"
                onChange={(e) => update("supplier", e.target.value)}
                placeholder={t("add_part_modal.supplier_placeholder")}
                value={form.supplier}
              />
            </div>

            <fieldset
              aria-labelledby="active-status-label"
              className="flex items-center justify-between rounded-xl border-none bg-surface-container-low px-4 py-3"
            >
              <div>
                <p
                  className="font-bold text-on-surface text-sm"
                  id="active-status-label"
                >
                  {t("add_part_modal.active_status")}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {t("add_part_modal.active_status_desc")}
                </p>
              </div>
              <Switch
                ariaLabelledBy="active-status-label"
                checked={form.isActive}
                onChange={(val) => update("isActive", val)}
              />
            </fieldset>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button
              onClick={handleRequestClose}
              type="button"
              variant="secondary"
            >
              {t("add_part_modal.cancel")}
            </Button>
            <Button icon="add" type="submit">
              {t("add_part_modal.add_part")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
