import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function AiPricingCallout() {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

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
        </div>
        <p className="mb-6 max-w-2xl text-on-primary-container text-sm leading-relaxed md:text-base">
          {t("improve_pricing_desc")}
        </p>
        {confirming ? (
          <div>
            <p className="mb-3 text-on-primary-container text-sm">
              {t("confirm_market_suggestion")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setConfirming(false)}
                size="sm"
                variant="primary"
              >
                {t("confirm")}
              </Button>
              <Button
                onClick={() => setConfirming(false)}
                size="sm"
                variant="ghost"
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            icon="check_circle"
            onClick={() => setConfirming(true)}
            variant="secondary"
          >
            {t("use_recommended_price")}
          </Button>
        )}
      </div>
    </div>
  );
}
