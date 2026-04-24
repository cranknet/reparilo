import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToastStore } from "@/stores/toast";

function ToastItem({
  id,
  message,
  type,
  undoLabel,
  undoAction,
  undoable,
}: {
  id: string;
  message: string;
  type: string;
  undoLabel?: string;
  undoAction?: () => void;
  undoable: boolean;
}) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    requestAnimationFrame(() => {
      el.classList.remove("opacity-0", "translate-y-4");
      el.classList.add("opacity-100", "translate-y-0");
    });
  }, []);

  const iconMap: Record<string, string> = {
    success: "check_circle",
    error: "error",
    info: "info",
  };
  const colorMap: Record<string, string> = {
    success: "text-success",
    error: "text-error",
    info: "text-primary",
  };
  const iconColor = colorMap[type] ?? "text-primary";

  const handleUndo = () => {
    undoAction?.();
    dismiss(id);
  };

  return (
    <div
      className="flex w-full max-w-sm translate-y-4 items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 opacity-0 shadow-xl transition-all duration-300"
      ref={ref}
    >
      <span className={`material-symbols-outlined ${iconColor} text-lg`}>
        {iconMap[type] || "info"}
      </span>
      <span className="min-w-0 flex-1 font-body text-on-surface text-sm">
        {t(message)}
      </span>
      {undoable && undoAction && (
        <button
          className="shrink-0 font-bold font-label text-primary text-xs uppercase tracking-wider hover:underline"
          onClick={handleUndo}
          type="button"
        >
          {undoLabel ?? t("undo")}
        </button>
      )}
      <button
        aria-label={t("close_modal")}
        className="text-on-surface-variant transition-colors hover:text-on-surface"
        onClick={() => dismiss(id)}
        type="button"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:start-auto sm:end-6 sm:bottom-6 sm:items-end sm:justify-end"
    >
      {toasts.map((t) => (
        <ToastItem
          id={t.id}
          key={t.id}
          message={t.message}
          type={t.type}
          undoAction={t.undoAction}
          undoable={t.undoable}
          undoLabel={t.undoLabel}
        />
      ))}
    </div>
  );
}
