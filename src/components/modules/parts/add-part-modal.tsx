import type { PartCategoryType } from "@shared/constants";
import { PartCategory } from "@shared/constants";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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

export default function AddPartModal({ onClose, onSubmit }: AddPartModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<AddPartFormData>({
    name: "",
    category: "",
    defaultPrice: "",
    supplier: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "category", string>>
  >({});

  function update<K extends keyof AddPartFormData>(
    key: K,
    value: AddPartFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && value.toString().trim()) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
    if (key === "category" && value) {
      setErrors((prev) => ({ ...prev, category: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Partial<Record<"name" | "category", string>> = {};
    if (!form.name.trim()) {
      newErrors.name = t("add_part_modal.error_name_required");
    }
    if (!form.category) {
      newErrors.category = t("add_part_modal.error_category_required");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit({
      name: form.name,
      category: form.category as PartCategoryType,
      defaultPrice: Number.parseInt(form.defaultPrice, 10) || 0,
      supplier: form.supplier,
      isActive: form.isActive,
    });
  }

  const labelCls = "mb-2 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close modal"
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-[20px]"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onClose();
          }
        }}
        type="button"
      />
      <div className="relative z-10 mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_40px_64px_-12px_rgba(0,64,161,0.06)]">
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-container-low px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold font-headline text-on-surface text-xl tracking-tight">
                  {t("add_part_modal.title")}
                </h2>
                <p className="mt-0.5 text-on-surface-variant text-sm">
                  {t("add_part_modal.subtitle")}
                </p>
              </div>
              <button
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                onClick={onClose}
                type="button"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-6 py-6">
            <div>
              <Label className={labelCls} htmlFor="part-name">
                {t("add_part_modal.part_name")}
              </Label>
              <Input
                id="part-name"
                onChange={(e) => update("name", e.target.value)}
                placeholder={t("add_part_modal.part_name_placeholder")}
                required
                value={form.name}
              />
              {errors.name && (
                <p className="mt-1.5 text-error text-sm">{errors.name}</p>
              )}
            </div>

            <div>
              <Label className={labelCls} htmlFor="part-category">
                {t("add_part_modal.category")}
              </Label>
              <div className="relative">
                <Select
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
                <p className="mt-1.5 text-error text-sm">{errors.category}</p>
              )}
            </div>

            <div>
              <Label className={labelCls} htmlFor="part-price">
                {t("add_part_modal.default_price")}
              </Label>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 font-mono text-on-surface-variant text-sm">
                  DA
                </span>
                <Input
                  className="ps-10 font-mono"
                  id="part-price"
                  min="0"
                  onChange={(e) => update("defaultPrice", e.target.value)}
                  placeholder="0"
                  required
                  step="1"
                  type="number"
                  value={form.defaultPrice}
                />
              </div>
            </div>

            <div>
              <Label className={labelCls} htmlFor="part-supplier">
                {t("add_part_modal.supplier")}{" "}
                <span className="font-normal text-on-surface-variant text-xs normal-case tracking-normal">
                  ({t("add_part_modal.optional")})
                </span>
              </Label>
              <Input
                id="part-supplier"
                onChange={(e) => update("supplier", e.target.value)}
                placeholder={t("add_part_modal.supplier_placeholder")}
                value={form.supplier}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
              <div>
                <p className="font-bold text-on-surface text-sm">
                  {t("add_part_modal.active_status")}
                </p>
                <p className="text-on-surface-variant text-xs">
                  {t("add_part_modal.active_status_desc")}
                </p>
              </div>
              <button
                aria-checked={form.isActive}
                aria-label={t("add_part_modal.active_status")}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  form.isActive ? "bg-primary" : "bg-surface-container-highest"
                }`}
                onClick={() => update("isActive", !form.isActive)}
                role="switch"
                type="button"
              >
                <span
                  className={`inline-start-[3px] absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform ltr:translate-x-[22px] rtl:-translate-x-[22px] ${
                    form.isActive
                      ? "ltr:translate-x-[22px] rtl:-translate-x-[22px]"
                      : "translate-x-0 ltr:translate-x-0 rtl:-translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button onClick={onClose} type="button" variant="secondary">
              {t("add_part_modal.cancel")}
            </Button>
            <Button type="submit">{t("add_part_modal.add_part")}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
