import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  onSend: (text: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
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
    <footer className="shrink-0 border-surface-container-highest border-t bg-surface-container-lowest px-4 py-4 md:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-surface-container-highest bg-surface-container-low px-2 py-2 transition-all focus-within:border-primary/30">
          <button
            className="shrink-0 p-2 text-on-surface-variant transition-colors hover:text-primary"
            type="button"
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <textarea
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-none bg-transparent py-2.5 text-sm outline-none"
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("ask_ai_placeholder")}
            ref={textareaRef}
            rows={1}
            value={value}
          />
          <button
            className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0040a1] to-[#0056d2] p-3 text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
            disabled={!value.trim()}
            onClick={handleSubmit}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </div>
        <p className="mt-2 text-center font-medium text-[10px] text-on-surface-variant">
          {t("ai_disclaimer")}
        </p>
      </div>
    </footer>
  );
}
