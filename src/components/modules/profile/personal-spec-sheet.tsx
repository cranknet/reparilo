import { useTranslation } from "react-i18next";
import {
  LABEL_CLS,
  LANGUAGE_OPTIONS,
} from "@/components/modules/profile/shared";

interface PersonalSpecSheetProps {
  error?: string;
  form: { email: string; language: string; name: string; username: string };
  success?: string;
}

export function PersonalSpecSheet({
  error,
  form,
  success,
}: PersonalSpecSheetProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {error && (
        <div
          aria-live="polite"
          className="rounded-lg bg-error-container p-4"
          role="alert"
        >
          <p className="font-bold text-on-error-container text-xs">{error}</p>
        </div>
      )}
      {success && (
        <div
          aria-live="polite"
          className="rounded-lg bg-primary-tint p-4"
          role="status"
        >
          <p className="font-bold text-success text-xs">{success}</p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
        <div>
          <p className={LABEL_CLS}>{t("profile_name")}</p>
          <p className="font-medium text-base text-on-surface">
            {form.name || "—"}
          </p>
        </div>
        <div>
          <p className={LABEL_CLS}>{t("username")}</p>
          <p className="font-medium text-base text-on-surface">
            {form.username || "—"}
          </p>
        </div>
        <div>
          <p className={LABEL_CLS}>{t("email")}</p>
          <p className="font-medium text-base text-on-surface">
            {form.email || "—"}
          </p>
        </div>
        <div>
          <p className={LABEL_CLS}>{t("profile_language")}</p>
          <p className="font-medium text-base text-on-surface">
            {LANGUAGE_OPTIONS.find((o) => o.value === form.language)?.label ??
              form.language}
          </p>
        </div>
      </div>
    </div>
  );
}
