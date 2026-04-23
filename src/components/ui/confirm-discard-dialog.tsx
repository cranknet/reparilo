import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ConfirmDiscardDialogProps {
  onDiscard: () => void;
  onKeepEditing: () => void;
  open: boolean;
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function trapTabInContainer(e: KeyboardEvent, container: HTMLElement) {
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  if (focusable.length === 0) {
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1) ?? focusable[0];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export default function ConfirmDiscardDialog({
  onDiscard,
  onKeepEditing,
  open,
}: ConfirmDiscardDialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(open && ref.current)) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        onKeepEditing();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        trapTabInContainer(e, ref.current);
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    ref.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onKeepEditing]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-describedby="confirm-close-desc"
      aria-labelledby="confirm-close-title"
      aria-modal="true"
      className="relative z-[60] mx-4 w-full max-w-[360px] overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-2xl"
      ref={ref}
      role="alertdialog"
    >
      <div className="px-6 py-6">
        <h3
          className="font-bold font-headline text-lg text-on-surface"
          id="confirm-close-title"
        >
          {t("add_part_modal.discard_title")}
        </h3>
        <p
          className="mt-2 text-on-surface-variant text-sm"
          id="confirm-close-desc"
        >
          {t("add_part_modal.discard_desc")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4">
        <Button onClick={onKeepEditing} type="button" variant="ghost">
          {t("add_part_modal.keep_editing")}
        </Button>
        <Button onClick={onDiscard} type="button" variant="destructive">
          {t("add_part_modal.discard")}
        </Button>
      </div>
    </div>
  );
}
