import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const INPUT_CLS =
  "w-full rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20";

const LABEL_CLS =
  "block font-bold text-xs text-on-surface-variant uppercase tracking-wider mb-2";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
];

interface PersonalFormProps {
  error?: string;
  form: { email: string; language: string; name: string; username: string };
  formRef: React.RefObject<HTMLFormElement | null>;
  initialLanguage: string;
  isDirty: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (field: string, value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function PersonalForm({
  error,
  form,
  initialLanguage,
  isDirty,
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
  formRef,
}: PersonalFormProps) {
  const { t } = useTranslation();
  const languageChanged = form.language !== initialLanguage;

  return (
    <>
      <form className="space-y-6" onSubmit={onSubmit} ref={formRef}>
        {error && (
          <div
            aria-live="polite"
            className="rounded-lg bg-error-container p-4"
            role="alert"
          >
            <p className="font-bold text-on-error-container text-xs">{error}</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <div>
            <label className={LABEL_CLS} htmlFor="profile-name">
              {t("profile_name")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-name"
              onChange={(e) => onChange("name", e.target.value)}
              type="text"
              value={form.name}
            />
          </div>

          <div>
            <label className={LABEL_CLS} htmlFor="profile-username">
              {t("username")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-username"
              onChange={(e) => onChange("username", e.target.value)}
              type="text"
              value={form.username}
            />
          </div>

          <div>
            <label className={LABEL_CLS} htmlFor="profile-email">
              {t("email")}
            </label>
            <input
              className={INPUT_CLS}
              id="profile-email"
              onChange={(e) => onChange("email", e.target.value)}
              type="email"
              value={form.email}
            />
          </div>

          <div>
            <label className={LABEL_CLS} htmlFor="profile-language">
              {t("profile_language")}
            </label>
            <div className="relative">
              <select
                className="w-full cursor-pointer appearance-none rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
                id="profile-language"
                onChange={(e) => onChange("language", e.target.value)}
                value={form.language}
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icon
                className="pointer-events-none absolute end-4 top-3.5 text-on-surface-variant"
                name="expand_more"
                size="sm"
              />
            </div>
            {languageChanged && (
              <p className="mt-1.5 text-on-surface-variant text-xs">
                {t("profile_language_preview")}
              </p>
            )}
          </div>
        </div>
      </form>

      {isDirty && (
        <div className="flex justify-end gap-3 border-surface-container-high border-t pt-4">
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            {t("profile_cancel_edit")}
          </Button>
          <Button
            icon="save"
            loading={isSubmitting}
            onClick={() => formRef.current?.requestSubmit()}
            size="sm"
            type="button"
            variant="primary"
          >
            {t("profile_save")}
          </Button>
        </div>
      )}
    </>
  );
}
