import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatInput from "@/components/modules/ai-analyst/chat-input";
import ChatMessage from "@/components/modules/ai-analyst/chat-message";
import AiConfigPanel from "@/components/modules/ai-analyst/config-panel";

interface Message {
  content: string;
  id: string;
  role: "assistant" | "user";
  timestamp: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    content:
      "Welcome back! I've analyzed today's shop metrics. Screen replacement turnaround is down 14% this week. Would you like to see a breakdown of parts inventory for the next 48 hours?",
    id: "greeting",
    role: "assistant",
    timestamp: "09:12",
  },
  {
    content:
      "Yes, show me the inventory report. Also flag any parts that are running low for the iPhone 15 Pro batch.",
    id: "user-1",
    role: "user",
    timestamp: "09:14",
  },
  {
    content:
      "Here's the inventory snapshot: 42 of 45 components are in stock. 3 items are flagged for reorder — OLED digitizer assemblies and adhesive kits are at minimum threshold. Battery cells for iPhone 15 Pro are available with 18 units on hand.",
    id: "ai-1",
    role: "assistant",
    timestamp: "09:14",
  },
];

export default function AiAnalystPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [configOpen, setConfigOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  });

  const handleSend = (text: string) => {
    const userMsg: Message = {
      content: text,
      id: `user-${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTimeout(() => {
      const aiMsg: Message = {
        content:
          "I'm analyzing that query against your shop data. Based on current trends, I'd recommend prioritizing the open repairs first — there are 3 jobs that have been in the queue for over 24 hours.",
        id: `ai-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1200);
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col md:h-[calc(100vh-6rem)]">
      <div className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-surface-container-highest border-b px-4 md:px-6">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <h2 className="font-bold font-headline text-on-surface text-sm tracking-tight md:text-base">
                {t("shop_intelligence_analyst")}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-primary text-xs transition-colors hover:bg-primary/5"
                onClick={handleClear}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">
                  delete_sweep
                </span>
                <span className="hidden sm:inline">{t("clear_history")}</span>
              </button>
              <button
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-primary text-xs transition-colors hover:bg-primary/5 xl:flex"
                onClick={() => setConfigOpen((v) => !v)}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">tune</span>
                <span>{t("configure")}</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-surface-container-low p-4 md:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <span className="material-symbols-outlined text-3xl text-primary">
                      psychology
                    </span>
                  </div>
                  <h3 className="mb-1 font-bold font-headline text-base text-on-surface">
                    {t("ai_analyst_empty_title")}
                  </h3>
                  <p className="max-w-xs text-on-surface-variant text-sm">
                    {t("ai_analyst_empty_desc")}
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <ChatInput onSend={handleSend} />
        </section>

        {configOpen && (
          <button
            aria-label="Close settings"
            className="fixed inset-0 z-30 bg-[oklch(12%_0.01_250)]/20 backdrop-blur-sm xl:hidden"
            onClick={() => setConfigOpen(false)}
            type="button"
          />
        )}

        <AiConfigPanel onClose={() => setConfigOpen(false)} open={configOpen} />
      </div>
    </div>
  );
}
