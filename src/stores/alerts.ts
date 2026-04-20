import { create } from "zustand";

interface Alert {
  id: string;
  job?: { id: string; jobCode: string };
  message: string;
  read: boolean;
  timestamp: number;
  type: string;
}

interface AlertsState {
  addAlert: (alert: Omit<Alert, "id" | "timestamp" | "read">) => void;
  alerts: Alert[];
  markRead: (id: string) => void;
}

// Monotonically increasing counter — fine for SPA sessions (not SSR-safe)
let nextId = 0;

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],

  addAlert: (alert) => {
    set((state) => ({
      alerts: [
        { ...alert, id: String(nextId++), read: false, timestamp: Date.now() },
        ...state.alerts,
      ],
    }));
  },

  markRead: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, read: true } : a)),
    }));
  },
}));
