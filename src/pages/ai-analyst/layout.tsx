import { useEffect } from "react";
import ConversationHistoryPanel from "@/components/modules/ai-analyst/conversation-history-panel";
import { useAiChatStore } from "@/stores/ai-chat";

export default function AiAnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initFromStorage = useAiChatStore((s) => s.initFromStorage);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <ConversationHistoryPanel />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
