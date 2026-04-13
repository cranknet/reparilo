import { useTranslation } from "react-i18next";

export default function AiPricingCallout() {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-inverse-surface p-6 md:p-8">
      <div className="absolute -top-6 -right-6 opacity-[0.06]">
        <span className="material-symbols-outlined text-[120px] md:text-[160px]">
          auto_awesome
        </span>
      </div>
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-inverse-primary text-xl">
            trending_up
          </span>
          <h3 className="font-extrabold font-headline text-inverse-on-surface text-lg">
            {t("optimize_pricing")}
          </h3>
        </div>
        <p className="mb-6 max-w-2xl text-inverse-on-surface/80 text-sm leading-relaxed md:text-base">
          {t("optimize_pricing_desc")}
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold font-headline text-[#0040a1] text-sm transition-all hover:bg-white/90"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">
            check_circle
          </span>
          {t("apply_market_suggestion")}
        </button>
      </div>
    </div>
  );
}
