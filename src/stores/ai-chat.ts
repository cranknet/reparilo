import { create } from "zustand";

const STORAGE_KEY_OPEN = "ai-chat-panel";
const STORAGE_KEY_WIDTH = "ai-chat-panel-width";
const MIN_PANEL_WIDTH = 220;
const MAX_PANEL_WIDTH = 480;
const DEFAULT_PANEL_WIDTH = 280;

interface AiChatState {
  activeConversationId: string | null;
  createNewConversation: () => void;
  getDraft: (conversationId: string) => string;
  initFromStorage: () => void;
  mobileSheetOpen: boolean;
  panelCollapsed: boolean;
  panelOpen: boolean;
  panelWidth: number;
  refreshKey: number;
  setActiveConversationId: (id: string | null) => void;
  setCollapsed: (collapsed: boolean) => void;
  setDraft: (conversationId: string, text: string) => void;
  setMobileSheetOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  togglePanel: () => void;
  triggerRefresh: () => void;
}

const drafts = new Map<string, string>();

export const useAiChatStore = create<AiChatState>((set, get) => ({
  activeConversationId: null,
  createNewConversation: () => set({ activeConversationId: null }),
  getDraft: (conversationId) => drafts.get(conversationId) ?? "",
  initFromStorage: () => {
    if (typeof window === "undefined") {
      return;
    }
    const isDesktop = window.innerWidth >= 1024;
    const storedOpen = localStorage.getItem(STORAGE_KEY_OPEN);
    const panelOpen = storedOpen === null ? isDesktop : storedOpen === "true";
    const storedWidth = localStorage.getItem(STORAGE_KEY_WIDTH);
    let panelWidth = DEFAULT_PANEL_WIDTH;
    if (storedWidth) {
      const parsed = Number(storedWidth);
      if (Number.isFinite(parsed)) {
        panelWidth = Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, parsed)
        );
      }
    }
    set({ panelOpen, panelWidth });
  },
  mobileSheetOpen: false,
  panelCollapsed: false,
  panelOpen: true,
  panelWidth: DEFAULT_PANEL_WIDTH,
  refreshKey: 0,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
  setCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
  setDraft: (conversationId, text) => {
    if (text) {
      drafts.set(conversationId, text);
    } else {
      drafts.delete(conversationId);
    }
  },
  setMobileSheetOpen: (open) => set({ mobileSheetOpen: open }),
  setPanelWidth: (width) => {
    const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, width));
    localStorage.setItem(STORAGE_KEY_WIDTH, String(clamped));
    set({ panelWidth: clamped });
  },
  togglePanel: () => {
    const next = !get().panelOpen;
    localStorage.setItem(STORAGE_KEY_OPEN, String(next));
    set({ panelOpen: next });
  },
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
