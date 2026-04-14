import { useTranslation } from "react-i18next";

const LANGUAGES = ["en", "fr", "ar"] as const;

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const normalizedLang = i18n.language.split("-")[0];
  const currentIndex = LANGUAGES.indexOf(
    normalizedLang as (typeof LANGUAGES)[number]
  );
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (resolvedIndex + 1) % LANGUAGES.length;

  const handleClick = () => {
    i18n.changeLanguage(LANGUAGES[nextIndex]);
  };

  return (
    <button
      aria-label={`Switch language. Current: ${LANGUAGES[resolvedIndex].toUpperCase()}`}
      className="flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1 font-bold text-on-surface-variant text-xs transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
      onClick={handleClick}
      type="button"
    >
      <span className="material-symbols-outlined text-sm">translate</span>
      {LANGUAGES[resolvedIndex].toUpperCase()}
    </button>
  );
}
