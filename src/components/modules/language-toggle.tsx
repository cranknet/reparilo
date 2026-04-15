import { LANGUAGES } from "@shared/constants";
import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const normalizedLang = i18n.language.split("-")[0];

  return (
    <div
      aria-label={t("language_switch")}
      className="flex items-center gap-1"
      role="radiogroup"
    >
      {LANGUAGES.map((lang) => (
        <button
          aria-label={t("language_switch_to", { lang: lang.toUpperCase() })}
          aria-pressed={normalizedLang === lang}
          className={`min-h-[44px] min-w-[44px] rounded-md px-2.5 py-1 font-label font-semibold text-xs uppercase tracking-wide transition-colors ${
            normalizedLang === lang
              ? "bg-primary/10 text-primary"
              : "text-on-surface-variant/50 hover:bg-surface-container-high hover:text-on-surface-variant"
          }`}
          key={lang}
          onClick={() => {
            i18n.changeLanguage(lang);
          }}
          type="button"
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
