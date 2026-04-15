import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatInput from "@/components/modules/ai-analyst/chat-input";
import ChatMessage from "@/components/modules/ai-analyst/chat-message";

const MODEL_OPTIONS = ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"] as const;
type ModelOption = (typeof MODEL_OPTIONS)[number];

interface Message {
  content: string;
  error?: boolean;
  id: string;
  role: "assistant" | "user";
  timestamp: string;
}

export default function AiAnalystPage() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [model, setModel] = useState<ModelOption>("gpt-4o");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const prevCountRef = useRef(0);
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    const newMessage = messages.length > prevCountRef.current;
    const streamEnded = prevStreamingRef.current && !isStreaming;
    if (newMessage || streamEnded) {
      const container = messagesEndRef.current?.parentElement;
      if (container) {
        const nearBottom =
          container.scrollHeight -
            container.scrollTop -
            container.clientHeight <
          150;
        if (nearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevCountRef.current = messages.length;
    prevStreamingRef.current = isStreaming;
  }, [messages.length, isStreaming]);

  function getTimeLocale(): string {
    if (i18n.language === "ar") {
      return "ar-DZ";
    }
    if (i18n.language === "fr") {
      return "fr-DZ";
    }
    return "en-GB";
  }

  const handleSend = (text: string) => {
    const userMsg: Message = {
      content: text,
      id: `user-${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString(getTimeLocale(), {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    // TODO: Replace mock timeout with real AI API streaming call
    setTimeout(() => {
      setIsStreaming(false);
      const aiMsg: Message = {
        content: t("ai_mock_response"),
        id: `ai-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString(getTimeLocale(), {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1200);
  };

  const handleClear = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      clearTimerRef.current = setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    setMessages([]);
    setClearConfirm(false);
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  function getModelLabel(m: ModelOption): string {
    if (m === "gpt-4o") {
      return t("gpt_4o_default");
    }
    if (m === "gpt-4o-mini") {
      return t("gpt_4o_mini");
    }
    return t("gpt_3_5_turbo");
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col md:h-[calc(100vh-6rem)]">
      <section className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between bg-surface-container px-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <h2 className="hidden font-bold font-headline text-on-surface text-sm tracking-tight md:block md:text-base">
              {t("shop_ai_assistant")}
            </h2>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary md:hidden">
              <span
                className="material-symbols-outlined text-lg text-on-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                build_circle
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                aria-label={t("analytical_model")}
                className="appearance-none rounded-full bg-surface-container-high px-3 py-2 pe-8 font-semibold text-on-surface-variant text-xs transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                onChange={(e) => setModel(e.target.value as ModelOption)}
                value={model}
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {getModelLabel(m)}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                expand_more
              </span>
            </div>
            <button
              aria-label={
                clearConfirm ? t("confirm_clear_history") : t("clear_history")
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 font-semibold text-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${clearConfirm ? "bg-error/10 text-error" : "text-primary hover:bg-primary/5"}`}
              onClick={handleClear}
              type="button"
            >
              <span className="material-symbols-outlined text-sm">
                {clearConfirm ? "warning" : "delete_sweep"}
              </span>
              <span className="hidden sm:inline">
                {clearConfirm ? t("confirm") : t("clear_history")}
              </span>
            </button>
          </div>
        </header>

        <div
          aria-label={t("chat_messages")}
          aria-live="polite"
          className="flex-1 overflow-y-auto bg-surface-container-low p-4 md:p-6"
          role="log"
        >
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div
                aria-label={t("ai_is_typing")}
                className="flex gap-3"
                role="status"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span
                    className="material-symbols-outlined text-primary text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    psychology
                  </span>
                </div>
                <div className="flex items-center rounded-2xl rounded-ss-sm bg-surface-container-lowest px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant/40" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant/40" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-on-surface-variant/40" />
                  </div>
                </div>
              </div>
            )}
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="material-symbols-outlined text-3xl text-primary">
                    psychology
                  </span>
                </div>
                <h3 className="mb-1 font-bold font-headline text-base text-on-surface">
                  {t("ai_assistant_empty_title")}
                </h3>
                <p className="max-w-xs text-on-surface-variant text-sm">
                  {t("ai_assistant_empty_desc")}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {[
                    t("suggested_repairs_this_week"),
                    t("suggested_parts_low"),
                    t("suggested_revenue_trend"),
                    t("suggested_best_technician"),
                  ].map((query) => (
                    <button
                      aria-label={t("ask_about", { topic: query })}
                      className="rounded-full bg-surface-container-high px-4 py-2 font-medium text-on-surface-variant text-xs transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                      key={query}
                      onClick={() => handleSend(query)}
                      type="button"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput disabled={isStreaming} onSend={handleSend} />
      </section>
    </div>
  );
}
