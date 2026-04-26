import type { OwnerDashboardDTO } from "@shared/types/dashboard";
import { create } from "zustand";
import api from "@/lib/api";

interface DashboardState {
  data: OwnerDashboardDTO | null;
  error: string | null;
  fetchDashboard: () => Promise<void>;
  isLoading: boolean;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/dashboard/owner");
      set({ data: res.data as OwnerDashboardDTO, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load dashboard";
      set({ isLoading: false, error: message });
    }
  },
}));
