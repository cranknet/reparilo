import { useTranslation } from "react-i18next";

interface UnsavedChangesBarProps {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}

export default function UnsavedChangesBar({
  onCancel,
  onSave,
  saving,
  visible,
}: UnsavedChangesBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`sticky bottom-4 z-30 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        visible
          ? "mt-4 max-h-24 opacity-100"
          : "pointer-events-none max-h-0 opacity-0"
      }`}
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-surface-container-low px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-on-surface-variant text-sm">
          {t("unsaved_changes")}
        </span>
        <div className="flex gap-3">
          <button
            className="min-h-11 rounded-xl px-4 font-semibold text-on-surface-variant text-sm transition-colors hover:bg-surface-container"
            onClick={onCancel}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2 font-bold text-on-primary text-sm transition-all active:opacity-80"
            disabled={saving}
            onClick={onSave}
            type="submit"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
            )}
            {saving ? t("settings_saving") : t("save_changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
