import { useTranslation } from "react-i18next";

const LANGUAGES = ["en", "fr", "ar"] as const;

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const currentIndex = LANGUAGES.indexOf(
    i18n.language as (typeof LANGUAGES)[number]
  );
  const nextIndex = (currentIndex + 1) % LANGUAGES.length;

  const handleClick = () => {
    i18n.changeLanguage(LANGUAGES[nextIndex]);
  };

  return (
    <button
      className="flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1 font-bold text-on-surface-variant text-xs transition-colors hover:text-primary"
      onClick={handleClick}
      type="button"
    >
      <span className="material-symbols-outlined text-sm">translate</span>
      {i18n.language.toUpperCase()}
    </button>
  );
}
