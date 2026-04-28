import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings";
import ChatInterface from "./chat-interface";

export default function AiAnalystPage() {
  const { aiSettings, fetchAiSettings } = useSettingsStore();
  const [loading, setLoading] = useState(!aiSettings);

  useEffect(() => {
    if (aiSettings) {
      setLoading(false);
    } else {
      fetchAiSettings()
        .catch(() => {
          /* stored in Zustand state */
        })
        .finally(() => setLoading(false));
    }
  }, [aiSettings, fetchAiSettings]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-2xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return <ChatInterface agentEnabled={aiSettings?.enabled ?? false} />;
}
