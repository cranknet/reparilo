interface ModalFooterProps {
  cancelLabel: string;
  isSubmitting: boolean;
  nextLabel: string;
  onClose: () => void;
  onNextStep: () => void;
  step: 1 | 2;
  submitLabel: string;
}

export default function ModalFooter({
  isSubmitting,
  onClose,
  onNextStep,
  step,
  submitLabel,
  cancelLabel,
  nextLabel,
}: ModalFooterProps) {
  return (
    <footer className="flex shrink-0 items-center justify-end gap-4 border-outline-variant border-t bg-surface-container-high px-4 py-4 md:px-8 md:py-6">
      <button
        className="px-6 py-3 font-bold font-headline text-on-surface-variant text-sm transition-colors hover:text-on-surface"
        onClick={onClose}
        type="button"
      >
        {cancelLabel}
      </button>
      {step === 1 ? (
        <button
          className="rounded-xl bg-primary px-8 py-3 font-bold font-headline text-on-primary text-sm transition-all active:scale-[0.98]"
          onClick={onNextStep}
          type="button"
        >
          {nextLabel}
        </button>
      ) : (
        <button
          className="rounded-xl bg-primary px-8 py-3 font-bold font-headline text-on-primary text-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {submitLabel}
        </button>
      )}
    </footer>
  );
}
