// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { useAiChatStore } from "@/stores/ai-chat";
import ConversationHistoryPanel from "../conversation-history-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  default: {
    delete: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe("ConversationHistoryPanel", () => {
  beforeEach(() => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { items: [], nextCursor: null },
    });
    useAiChatStore.setState({
      activeConversationId: null,
      mobileSheetOpen: true,
      panelCollapsed: false,
      panelOpen: false,
      panelWidth: 280,
      refreshKey: 0,
    });
  });

  it("renders a mobile history sheet when opened on tablet/mobile", async () => {
    render(<ConversationHistoryPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "ai_history_title" })
      ).toBeInTheDocument();
    });
  });
});
