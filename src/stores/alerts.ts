import { create } from "zustand";
import api from "@/lib/api";

interface InAppAlert {
  createdAt: string;
  id: string;
  job?: { id: string; jobCode: string } | null;
  message: string;
  readAt: string | null;
  type: string;
}

interface AlertsState {
  addAlert: (
    alert: Omit<InAppAlert, "id" | "createdAt" | "readAt"> & {
      id?: string;
      createdAt?: string;
      readAt?: string | null;
    }
  ) => void;
  alerts: InAppAlert[];
  fetchAlerts: () => Promise<void>;
  initialized: boolean;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  unreadCount: number;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  initialized: false,
  unreadCount: 0,

  fetchAlerts: async () => {
    try {
      const res = await api.get("/notifications/in-app", {
        params: { filter: "all", limit: 100 },
      });
      set({
        alerts: res.data.notifications as InAppAlert[],
        initialized: true,
        unreadCount: res.data.unreadCount as number,
      });
    } catch {
      set({ initialized: true });
    }
  },

  addAlert: (alert) => {
    set((state) => {
      const exists = alert.id && state.alerts.some((a) => a.id === alert.id);
      if (exists) {
        return state;
      }
      const newAlert: InAppAlert = {
        createdAt: alert.createdAt ?? new Date().toISOString(),
        id: alert.id ?? crypto.randomUUID(),
        job: alert.job,
        message: alert.message,
        readAt: alert.readAt ?? null,
        type: alert.type,
      };
      return {
        alerts: [newAlert, ...state.alerts],
        unreadCount: state.unreadCount + (newAlert.readAt ? 0 : 1),
      };
    });
  },

  markRead: async (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, readAt: a.readAt ?? new Date().toISOString() } : a
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.alerts.find((a) => a.id === id && !a.readAt) ? 1 : 0)
      ),
    }));
    try {
      await api.put(`/notifications/in-app/${id}/read`);
    } catch {
      const current = get().alerts.find((a) => a.id === id);
      if (current) {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, readAt: null } : a
          ),
          unreadCount: state.unreadCount + 1,
        }));
      }
    }
  },

  markAllRead: async () => {
    const previousAlerts = get().alerts;
    const previousCount = get().unreadCount;
    set((state) => ({
      alerts: state.alerts.map((a) => ({
        ...a,
        readAt: a.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
    try {
      await api.put("/notifications/in-app/read-all");
    } catch {
      set({ alerts: previousAlerts, unreadCount: previousCount });
    }
  },
}));
