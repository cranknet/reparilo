import type {
  FrontDeskDashboardDTO,
  OwnerDashboardDTO,
  TechnicianDashboardDTO,
} from "@shared/types/dashboard";
import { create } from "zustand";
import api, { getErrorMessage } from "@/lib/api";

interface DashboardState {
  data: OwnerDashboardDTO | null;
  error: string | null;
  fetchDashboard: () => Promise<void>;
  fetchFrontDesk: () => Promise<void>;
  fetchTechnician: () => Promise<void>;
  frontDeskData: FrontDeskDashboardDTO | null;
  isLoading: boolean;
  techData: TechnicianDashboardDTO | null;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  frontDeskData: null,
  techData: null,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/dashboard/owner");
      set({ data: res.data as OwnerDashboardDTO, isLoading: false });
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load dashboard");
      set({ isLoading: false, error: message });
    }
  },

  fetchFrontDesk: async () => {
    try {
      const res = await api.get("/dashboard/front-desk");
      set({ frontDeskData: res.data as FrontDeskDashboardDTO });
    } catch {
      /* front-desk dashboard fetch handled silently */
    }
  },

  fetchTechnician: async () => {
    try {
      const res = await api.get("/dashboard/technician");
      set({ techData: res.data as TechnicianDashboardDTO });
    } catch {
      /* technician dashboard fetch handled silently */
    }
  },
}));
