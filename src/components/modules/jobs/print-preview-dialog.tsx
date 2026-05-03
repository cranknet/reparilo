import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "@/stores/ui";

const LABEL_WIDTH_PX = 152;
const LABEL_HEIGHT_PX = 76;
const PREVIEW_SCALE = 2.5;

export default function PrintPreviewDialog() {
  const jobId = useUiStore((s) => s.printPreviewJobId);
  const closePrintPreview = useUiStore((s) => s.closePrintPreview);
  const { t } = useTranslation();

  const handlePrintLabel = useCallback(() => {
    if (jobId) {
      window.open(`/api/receipts/${jobId}/label`, "_blank");
    }
  }, [jobId]);

  const handlePrintReceipt = useCallback(() => {
    if (jobId) {
      window.open(`/api/receipts/${jobId}/receipt`, "_blank");
    }
  }, [jobId]);

  if (!jobId) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      <button
        aria-label={t("close")}
        className="absolute inset-0 bg-on-surface/40"
        onClick={closePrintPreview}
        type="button"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 bg-surface-container-low px-6 py-4">
          <span className="material-symbols-outlined text-2xl text-primary">
            label
          </span>
          <div className="flex-1">
            <h2 className="font-bold font-headline text-lg text-on-surface">
              {t("print_preview_title")}
            </h2>
            <p className="font-label text-on-surface-variant text-xs">
              {t("print_preview_subtitle")}
            </p>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high"
            onClick={closePrintPreview}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-container p-6">
          <div
            className="shrink-0"
            style={{
              width: LABEL_WIDTH_PX * PREVIEW_SCALE,
              height: LABEL_HEIGHT_PX * PREVIEW_SCALE,
            }}
          >
            <div
              className="origin-top-left"
              style={{
                width: LABEL_WIDTH_PX,
                height: LABEL_HEIGHT_PX,
                transform: `scale(${PREVIEW_SCALE})`,
              }}
            >
              <iframe
                className="h-full w-full border-0"
                src={`/api/receipts/${jobId}/label?preview=1`}
                title={t("print_preview_label_alt")}
              />
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-outline-variant/30 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface-container-high px-5 font-bold font-headline text-on-surface text-sm transition-colors hover:bg-surface-container"
            onClick={closePrintPreview}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              check_circle
            </span>
            {t("print_preview_done")}
          </button>
          <button
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-surface-container-high px-5 font-bold font-headline text-on-surface text-sm transition-colors hover:bg-surface-container"
            onClick={handlePrintReceipt}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              receipt_long
            </span>
            {t("print_preview_receipt")}
          </button>
          <button
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold font-headline text-on-primary text-sm transition-colors hover:bg-primary-container hover:text-on-primary-container"
            onClick={handlePrintLabel}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            {t("print_preview_label")}
          </button>
        </footer>
      </div>
    </div>
  );
}
