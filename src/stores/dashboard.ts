import type {
  FrontDeskDashboardDTO,
  OwnerDashboardDTO,
  TechnicianDashboardDTO,
} from "@shared/types/dashboard";
import { create } from "zustand";
import i18n from "@/i18n";
import api, { getErrorMessage } from "@/lib/api";

interface DashboardState {
  data: OwnerDashboardDTO | null;
  error: string | null;
  fetchDashboard: () => Promise<void>;
  fetchFrontDesk: () => Promise<void>;
  fetchTechnician: () => Promise<void>;
  frontDeskData: FrontDeskDashboardDTO | null;
  frontDeskError: string | null;
  frontDeskLoading: boolean;
  isLoading: boolean;
  techData: TechnicianDashboardDTO | null;
  techError: string | null;
  techLoading: boolean;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  frontDeskData: null,
  frontDeskError: null,
  frontDeskLoading: false,
  techData: null,
  techError: null,
  techLoading: false,
  isLoading: false,
  error: null,

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/dashboard/owner");
      set({ data: res.data as OwnerDashboardDTO, isLoading: false });
    } catch (err: unknown) {
      const message = getErrorMessage(err, i18n.t("errors.fetch_dashboard"));
      set({ isLoading: false, error: message });
    }
  },

  fetchFrontDesk: async () => {
    set({ frontDeskLoading: true, frontDeskError: null });
    try {
      const res = await api.get("/dashboard/front-desk");
      set({
        frontDeskData: res.data as FrontDeskDashboardDTO,
        frontDeskLoading: false,
      });
    } catch (err: unknown) {
      set({
        frontDeskData: null,
        frontDeskError: getErrorMessage(err, i18n.t("errors.fetch_front_desk")),
        frontDeskLoading: false,
      });
    }
  },

  fetchTechnician: async () => {
    set({ techLoading: true, techError: null });
    try {
      const res = await api.get("/dashboard/technician");
      set({ techData: res.data as TechnicianDashboardDTO, techLoading: false });
    } catch (err: unknown) {
      set({
        techData: null,
        techError: getErrorMessage(err, i18n.t("errors.fetch_technician")),
        techLoading: false,
      });
    }
  },
}));
