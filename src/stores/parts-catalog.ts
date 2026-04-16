import type { PartsCatalog } from "@shared/types";
import { create } from "zustand";
import api from "@/lib/api";

interface PartsCatalogState {
  clearError: () => void;
  createPart: (data: {
    name: string;
    category: string;
    defaultPrice: number;
    supplier?: string;
  }) => Promise<PartsCatalog>;
  error: string | null;
  fetchParts: (params?: {
    cursor?: string;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  nextCursor: string | null;
  parts: PartsCatalog[];
  togglePartActive: (id: string, isActive: boolean) => Promise<void>;
  totalCount: number;
  updatePart: (
    id: string,
    data: Record<string, unknown>
  ) => Promise<PartsCatalog>;
}

export const usePartsCatalogStore = create<PartsCatalogState>((set) => ({
  parts: [],
  totalCount: 0,
  nextCursor: null,
  isLoading: false,
  error: null,

  fetchParts: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/parts", { params });
      set({
        parts: res.data.parts,
        nextCursor: res.data.nextCursor ?? null,
        totalCount: res.data.totalCount ?? 0,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch parts";
      set({ isLoading: false, error: message });
    }
  },

  createPart: async (data) => {
    set({ error: null });
    try {
      const res = await api.post("/parts", data);
      const newPart = res.data as PartsCatalog;
      set((state) => ({
        parts: [newPart, ...state.parts],
        totalCount: state.totalCount + 1,
      }));
      return newPart;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create part";
      set({ error: message });
      throw new Error(message);
    }
  },

  updatePart: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.patch(`/parts/${id}`, data);
      const updated = res.data as PartsCatalog;
      set((state) => ({
        parts: state.parts.map((p) => (p.id === id ? updated : p)),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update part";
      set({ error: message });
      throw new Error(message);
    }
  },

  togglePartActive: async (id, isActive) => {
    set({ error: null });
    try {
      const res = await api.patch(`/parts/${id}/status`, { isActive });
      const updated = res.data as PartsCatalog;
      set((state) => ({
        parts: state.parts.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle part status";
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
