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
          <article className="rounded-2xl rounded-se-sm bg-gradient-to-br from-primary to-surface-tint px-4 py-3 text-on-primary text-sm leading-relaxed shadow-md">
            {message.content}
          </article>
          <span className="me-1 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
            {t("you")} &bull; {message.timestamp}
          </span>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container">
          <span
            aria-hidden="true"
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
          aria-hidden="true"
          className="material-symbols-outlined text-primary text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          psychology
        </span>
      </div>
      <div className="flex max-w-[80%] flex-col space-y-1.5 sm:max-w-[70%]">
        <article className="rounded-2xl rounded-ss-sm bg-surface-container-lowest px-4 py-3 text-on-surface text-sm leading-relaxed shadow-sm">
          {message.content}
        </article>
        <span className="ms-1 font-bold text-on-surface-variant text-xs uppercase tracking-wider">
          {t("ai_analyst")} &bull; {message.timestamp}
        </span>
      </div>
    </div>
  );
}
