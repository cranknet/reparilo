import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function AiPricingCallout() {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary-container p-6 md:p-8">
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-on-primary-container text-xl">
            trending_up
          </span>
          <h3 className="font-extrabold font-headline text-lg text-on-primary-container">
            {t("improve_pricing")}
          </h3>
          <span className="rounded-full bg-on-primary-container/15 px-2.5 py-0.5 font-bold text-on-primary-container text-xs uppercase tracking-wide">
            {t("coming_soon")}
          </span>
        </div>
        <p className="mb-6 max-w-2xl text-on-primary-container text-sm leading-relaxed md:text-base">
          {t("improve_pricing_desc")}
        </p>
        <Button disabled icon="check_circle" variant="secondary">
          {t("use_recommended_price")}
        </Button>
      </div>
    </div>
  );
}
