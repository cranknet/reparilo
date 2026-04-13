import { useTranslation } from "react-i18next";

interface Message {
  content: string;
  id: string;
  role: "assistant" | "user";
  timestamp: string;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="flex max-w-[80%] flex-col items-end space-y-1.5 sm:max-w-[70%]">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#0040a1] to-[#0056d2] px-4 py-3 text-sm text-white leading-relaxed shadow-md">
            {message.content}
          </div>
          <span className="mr-1 font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
            {t("you")} &bull; {message.timestamp}
          </span>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container">
          <span
            className="material-symbols-outlined text-secondary text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span
          className="material-symbols-outlined text-primary text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          psychology
        </span>
      </div>
      <div className="flex max-w-[80%] flex-col space-y-1.5 sm:max-w-[70%]">
        <div className="rounded-2xl rounded-tl-sm bg-surface-container-lowest px-4 py-3 text-on-surface text-sm leading-relaxed shadow-sm">
          {message.content}
        </div>
        <span className="ml-1 font-bold text-[10px] text-on-surface-variant uppercase tracking-widest">
          {t("ai_analyst")} &bull; {message.timestamp}
        </span>
      </div>
    </div>
  );
}
