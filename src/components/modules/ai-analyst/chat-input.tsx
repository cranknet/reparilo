import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

export default function ChatInput({ disabled, onSend }: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <footer className="shrink-0 bg-surface-container-lowest px-4 py-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 rounded-2xl bg-surface-container-high px-2 py-2 transition-all focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            aria-describedby="ai-disclaimer"
            aria-label={t("ask_ai_placeholder")}
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-none bg-transparent py-2.5 text-sm outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/30"
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("ask_ai_placeholder_short")}
            ref={textareaRef}
            rows={1}
            value={value}
          />
          <button
            aria-label={t("send_message")}
            className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-surface-tint p-3 text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            disabled={!value.trim() || disabled}
            onClick={handleSubmit}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </div>
        <p
          className="mt-2 text-center font-medium text-on-surface-variant text-xs"
          id="ai-disclaimer"
        >
          {t("ai_disclaimer")}
        </p>
      </div>
    </footer>
  );
}
