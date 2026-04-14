import { useTranslation } from "react-i18next";

interface AiCalloutProps {
  insight: string;
}

export default function AiCallout({ insight }: AiCalloutProps) {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-highest p-1">
      <div className="rounded-[10px] bg-surface-container-low p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white md:h-12 md:w-12">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <div>
            <h4 className="font-bold font-headline text-on-surface text-sm md:text-base">
              {t("ask_ai_analyst")}
            </h4>
            <p className="text-[10px] text-on-surface-variant md:text-xs">
              {t("ai_analyst_subtitle")}
            </p>
          </div>
        </div>
        <div className="mb-4 rounded-lg border border-white/80 bg-white/60 p-3 text-on-surface-variant text-xs italic md:text-sm">
          &ldquo;{insight}&rdquo;
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-on-surface py-2.5 font-bold text-sm text-white transition-all hover:bg-[oklch(12%_0.01_250)]/90"
          type="button"
        >
          {t("open_ai_insights")}
          <span className="material-symbols-outlined text-sm">north_east</span>
        </button>
      </div>
    </div>
  );
}
