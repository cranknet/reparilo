import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface ConfirmDiscardDialogProps {
  description?: string;
  discardLabel?: string;
  keepLabel?: string;
  onDiscard: () => void;
  onKeepEditing: () => void;
  open: boolean;
  title?: string;
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
  title,
  description,
  keepLabel,
  discardLabel,
}: ConfirmDiscardDialogProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(open && ref.current)) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onKeepEditing();
        return;
      }
      if (e.key === "Tab" && ref.current) {
        e.stopPropagation();
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
          {title ?? t("add_part_modal.discard_title")}
        </h3>
        <p
          className="mt-2 text-on-surface-variant text-sm"
          id="confirm-close-desc"
        >
          {description ?? t("add_part_modal.discard_desc")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4">
        <Button onClick={onKeepEditing} type="button" variant="ghost">
          {keepLabel ?? t("add_part_modal.keep_editing")}
        </Button>
        <Button onClick={onDiscard} type="button" variant="destructive">
          {discardLabel ?? t("add_part_modal.discard")}
        </Button>
      </div>
    </div>
  );
}
