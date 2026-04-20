import type {
  AiSettings,
  NotificationTemplate,
  ShopSettings,
} from "@shared/types";
import { create } from "zustand";
import i18n from "@/i18n";
import api from "@/lib/api";

interface SettingsState {
  aiSettings: AiSettings | null;
  clearError: () => void;
  error: string | null;
  fetchAiSettings: () => Promise<void>;
  fetchNotificationTemplates: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchShopSettings: () => Promise<void>;
  isLoading: boolean;
  notificationTemplates: NotificationTemplate[];
  saveAiSettings: (data: {
    endpointUrl: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
  }) => Promise<AiSettings>;
  saveShopSettings: (data: {
    shopName: string;
    address?: string;
    phone?: string;
    currency?: string;
    receiptFooter?: string;
  }) => Promise<ShopSettings>;
  shopSettings: ShopSettings | null;
  testAiConnection: () => Promise<{ success: boolean; message: string }>;
  updateNotificationTemplate: (
    id: string,
    data: {
      name: string;
      channel: "WHATSAPP" | "SMS";
      body: string;
      isDefault?: boolean;
    }
  ) => Promise<NotificationTemplate>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  aiSettings: null,
  shopSettings: null,
  notificationTemplates: [],
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/settings");
      set({
        aiSettings: res.data.ai,
        shopSettings: res.data.shop,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : i18n.t("errors.fetch_settings");
      set({ isLoading: false, error: message });
    }
  },

  fetchAiSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/settings/ai");
      set({ aiSettings: res.data, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : i18n.t("errors.fetch_ai_settings");
      set({ isLoading: false, error: message });
    }
  },

  saveAiSettings: async (data) => {
    set({ error: null });
    try {
      const res = await api.put("/settings/ai", data);
      const updated = res.data as AiSettings;
      set({ aiSettings: updated });
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : i18n.t("errors.save_ai_settings");
      set({ error: message });
      throw new Error(message);
    }
  },

  testAiConnection: async () => {
    set({ error: null });
    try {
      const res = await api.post("/settings/ai/test");
      return res.data as { success: boolean; message: string };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.t("errors.test_ai_connection");
      set({ error: message });
      return { success: false, message };
    }
  },

  fetchShopSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/settings/shop");
      set({ shopSettings: res.data, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.t("errors.fetch_shop_settings");
      set({ isLoading: false, error: message });
    }
  },

  saveShopSettings: async (data) => {
    set({ error: null });
    try {
      const res = await api.put("/settings/shop", data);
      const updated = res.data as ShopSettings;
      set({ shopSettings: updated });
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.t("errors.save_shop_settings");
      set({ error: message });
      throw new Error(message);
    }
  },

  fetchNotificationTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/settings/notifications/templates");
      set({ notificationTemplates: res.data, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.t("errors.fetch_notifications");
      set({ isLoading: false, error: message });
    }
  },

  updateNotificationTemplate: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.put(
        `/settings/notifications/templates/${id}`,
        data
      );
      const updated = res.data as NotificationTemplate;
      set((state) => ({
        notificationTemplates: state.notificationTemplates.map((t) =>
          t.id === id ? updated : t
        ),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : i18n.t("errors.update_notification_template");
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
