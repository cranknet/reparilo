import { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface DeleteRepairDialogProps {
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  repairName: string;
}

export default function DeleteRepairDialog({
  onClose,
  onConfirm,
  open,
  repairName,
}: DeleteRepairDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      return;
    }
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
    >
      <button
        aria-label={t("close_modal")}
        className="absolute inset-0 bg-on-surface/40"
        onClick={onClose}
        type="button"
      />
      <div className="modal-surface relative z-10 w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-2xl">
        <h2 className="mb-2 font-bold font-headline text-error text-lg">
          {t("delete_repair_confirm_title")}
        </h2>
        <p className="mb-6 text-on-surface-variant text-sm">
          {repairName
            ? t("delete_repair_confirm_desc_named", { name: repairName })
            : t("delete_repair_confirm_desc")}
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 font-bold font-headline text-on-surface-variant text-sm hover:text-on-surface"
            onClick={onClose}
            type="button"
          >
            {t("cancel")}
          </button>
          <button
            className="rounded-xl bg-error px-6 py-2 font-bold font-headline text-on-error text-sm"
            onClick={onConfirm}
            type="button"
          >
            {t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
