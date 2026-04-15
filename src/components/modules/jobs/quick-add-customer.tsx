import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

interface CustomerFormData {
  email: string;
  name: string;
  phone: string;
}

interface QuickAddCustomerProps {
  onAdd: (data: CustomerFormData) => void;
  onClose: () => void;
}

export type { CustomerFormData };

const labelCls =
  "mb-2 ml-1 block font-bold font-label text-[11px] uppercase tracking-widest text-on-surface-variant";

export default function QuickAddCustomer({
  onAdd,
  onClose,
}: QuickAddCustomerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CustomerFormData>({
    email: "",
    name: "",
    phone: "",
  });

  const update = useCallback(
    <K extends keyof CustomerFormData>(key: K, value: CustomerFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onAdd(form);
    },
    [form, onAdd]
  );

  return (
    <section className="relative">
      <div className="rounded-xl bg-surface-container-lowest p-6 ring-1 ring-outline-variant">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">
              person_add
            </span>
            <h2 className="font-bold font-headline text-primary text-sm">
              {t("intake.new_customer")}
            </h2>
          </div>
          <button
            className="group flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-surface-container-high"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-on-surface-variant transition-colors group-hover:text-on-surface">
              close
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="group md:col-span-2">
              <label className={labelCls} htmlFor="qa-name">
                {t("intake.full_name")}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-lg text-outline">
                  person
                </span>
                <input
                  className="h-[52px] w-full rounded-xl border-none bg-surface-container-highest pr-4 pl-12 font-body text-on-surface text-sm transition-all placeholder:text-outline/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                  id="qa-name"
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={t("intake.full_name_placeholder")}
                  type="text"
                  value={form.name}
                />
              </div>
            </div>

            <div className="group">
              <label className={labelCls} htmlFor="qa-phone">
                {t("intake.phone")}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-lg text-outline">
                  phone
                </span>
                <input
                  className="h-[52px] w-full rounded-xl border-none bg-surface-container-highest pr-4 pl-12 font-body text-on-surface text-sm transition-all placeholder:text-outline/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                  id="qa-phone"
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+213..."
                  type="tel"
                  value={form.phone}
                />
              </div>
            </div>

            <div className="group">
              <label className={labelCls} htmlFor="qa-email">
                {t("intake.email")}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-lg text-outline">
                  mail
                </span>
                <input
                  className="h-[52px] w-full rounded-xl border-none bg-surface-container-highest pr-4 pl-12 font-body text-on-surface text-sm transition-all placeholder:text-outline/50 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                  id="qa-email"
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  value={form.email}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              className="flex h-12 items-center gap-2 rounded-xl bg-primary px-6 font-bold font-headline text-on-primary text-sm transition-all active:scale-[0.98]"
              type="submit"
            >
              <span className="material-symbols-outlined text-sm">check</span>
              {t("intake.add_customer")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
