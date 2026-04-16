import type { RepairCatalog } from "@shared/types";
import { create } from "zustand";
import api from "@/lib/api";

interface RepairCatalogState {
  clearError: () => void;
  createRepair: (data: {
    name: string;
    category: string;
    defaultPrice: number;
  }) => Promise<RepairCatalog>;
  error: string | null;
  fetchRepairs: (params?: {
    cursor?: string;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  nextCursor: string | null;
  repairs: RepairCatalog[];
  toggleRepairActive: (id: string, isActive: boolean) => Promise<void>;
  totalCount: number;
  updateRepair: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<RepairCatalog>;
}

export const useRepairCatalogStore = create<RepairCatalogState>((set) => ({
  repairs: [],
  totalCount: 0,
  nextCursor: null,
  isLoading: false,
  error: null,

  fetchRepairs: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/repairs", { params });
      set({
        repairs: res.data.repairs,
        nextCursor: res.data.nextCursor ?? null,
        totalCount: res.data.totalCount ?? 0,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch repairs";
      set({ isLoading: false, error: message });
    }
  },

  createRepair: async (data) => {
    set({ error: null });
    try {
      const res = await api.post("/repairs", data);
      const newRepair = res.data as RepairCatalog;
      set((state) => ({
        repairs: [newRepair, ...state.repairs],
        totalCount: state.totalCount + 1,
      }));
      return newRepair;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create repair";
      set({ error: message });
      throw new Error(message);
    }
  },

  updateRepair: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.patch(`/repairs/${id}`, data);
      const updated = res.data as RepairCatalog;
      set((state) => ({
        repairs: state.repairs.map((r) => (r.id === id ? updated : r)),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update repair";
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleRepairActive: async (id, isActive) => {
    set({ error: null });
    try {
      const res = await api.patch(`/repairs/${id}/status`, { isActive });
      const updated = res.data as RepairCatalog;
      set((state) => ({
        repairs: state.repairs.map((r) => (r.id === id ? updated : r)),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle repair status";
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
