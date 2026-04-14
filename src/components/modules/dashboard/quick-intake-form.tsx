import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function QuickIntakeForm() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border-primary border-t-4 bg-surface-container-lowest shadow-premium">
      <button
        className="flex w-full items-center justify-between p-6 text-left"
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
        <form
          className="space-y-4 px-6 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div>
            <label
              className="mb-1 block font-bold text-[10px] text-on-surface-variant uppercase tracking-widest"
              htmlFor="quick-intake-customer"
            >
              {t("front_desk.customer_name")}
            </label>
            <input
              className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
              id="quick-intake-customer"
              placeholder={t("front_desk.customer_name_placeholder")}
              type="text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1 block font-bold text-[10px] text-on-surface-variant uppercase tracking-widest"
                htmlFor="quick-intake-phone"
              >
                {t("front_desk.phone")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-phone"
                placeholder="+213..."
                type="tel"
              />
            </div>
            <div>
              <label
                className="mb-1 block font-bold text-[10px] text-on-surface-variant uppercase tracking-widest"
                htmlFor="quick-intake-device"
              >
                {t("front_desk.device")}
              </label>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                id="quick-intake-device"
                placeholder={t("front_desk.device_placeholder")}
                type="text"
              />
            </div>
          </div>
          <div>
            <label
              className="mb-1 block font-bold text-[10px] text-on-surface-variant uppercase tracking-widest"
              htmlFor="quick-intake-issue"
            >
              {t("front_desk.issue_description")}
            </label>
            <textarea
              className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
              id="quick-intake-issue"
              placeholder={t("front_desk.issue_placeholder")}
              rows={3}
            />
          </div>
          <button
            className="mt-2 w-full rounded-xl bg-gradient-to-br from-primary to-primary-container py-4 font-bold text-white shadow-premium transition-all hover:opacity-90"
            type="submit"
          >
            {t("intake.create_job")}
          </button>
        </form>
      )}
    </div>
  );
}
