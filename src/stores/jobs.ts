import type { JobStatusType } from "@shared/constants";
import type { Job, JobNote, JobPart, JobRepair } from "@shared/types";
import { create } from "zustand";
import api from "@/lib/api";

interface JobMetrics {
  [status: string]: number;
}

interface JobsState {
  addNote: (
    jobId: string,
    content: string,
    isCustomerVisible?: boolean
  ) => Promise<JobNote>;
  addPart: (
    jobId: string,
    data: {
      partId?: string;
      partName: string;
      category: string;
      unitPrice: number;
      quantity?: number;
      supplier?: string;
    }
  ) => Promise<JobPart>;
  addRepair: (
    jobId: string,
    data: {
      repairId?: string;
      repairName: string;
      category: string;
      price: number;
    }
  ) => Promise<JobRepair>;
  clearError: () => void;
  createJob: (data: {
    customerEmail?: string;
    customerId?: string;
    customerName: string;
    customerPhone: string;
    deviceBrand: string;
    deviceModel: string;
    color?: string;
    reportedProblem: string;
    conditionNotes?: string;
    estimatedCost: number;
    estimatedDate?: string;
    depositAmount?: number;
    technicianId?: string;
    isWarrantyReturn?: boolean;
    warrantyForJobId?: string;
  }) => Promise<Job>;
  error: string | null;

  fetchJobs: (params?: {
    cursor?: string;
    limit?: number;
    status?: string;
    technicianId?: string;
    search?: string;
  }) => Promise<void>;
  fetchMetrics: () => Promise<void>;
  isCreatingJob: boolean;
  isLoadingJobs: boolean;
  isLoadingMetrics: boolean;
  jobs: Job[];
  metrics: JobMetrics | null;
  nextCursor: string | null;
  removePart: (jobId: string, partId: string) => Promise<void>;
  removeRepair: (jobId: string, repairId: string) => Promise<void>;
  totalCount: number;
  transitionStatus: (id: string, status: JobStatusType) => Promise<Job>;
  updateJob: (id: string, data: Record<string, unknown>) => Promise<Job>;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  metrics: null,
  totalCount: 0,
  nextCursor: null,
  isLoadingJobs: false,
  isLoadingMetrics: false,
  isCreatingJob: false,
  error: null,

  fetchJobs: async (params) => {
    set({ isLoadingJobs: true, error: null });
    try {
      const res = await api.get("/jobs", { params });
      set({
        jobs: res.data.jobs,
        nextCursor: res.data.nextCursor ?? null,
        totalCount: res.data.totalCount ?? 0,
        isLoadingJobs: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch jobs";
      set({ isLoadingJobs: false, error: message });
    }
  },

  fetchMetrics: async () => {
    set({ isLoadingMetrics: true, error: null });
    try {
      const res = await api.get("/jobs/metrics");
      set({ metrics: res.data, isLoadingMetrics: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch metrics";
      set({ isLoadingMetrics: false, error: message });
    }
  },

  createJob: async (data) => {
    set({ isCreatingJob: true, error: null });
    try {
      const res = await api.post("/jobs", data);
      const newJob = res.data as Job;
      set((state) => ({
        jobs: [newJob, ...state.jobs],
        totalCount: state.totalCount + 1,
        isCreatingJob: false,
      }));
      return newJob;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create job";
      set({ isCreatingJob: false, error: message });
      throw new Error(message);
    }
  },

  updateJob: async (id, data) => {
    set({ error: null });
    try {
      const res = await api.patch(`/jobs/${id}`, data);
      const updated = res.data as Job;
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update job";
      set({ error: message });
      throw new Error(message);
    }
  },

  transitionStatus: async (id, status) => {
    set({ error: null });
    try {
      const res = await api.patch(`/jobs/${id}/status`, { status });
      const updated = res.data as Job;
      set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
      }));
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to transition status";
      set({ error: message });
      throw new Error(message);
    }
  },

  addNote: async (jobId, content, isCustomerVisible = false) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/notes`, {
        content,
        isCustomerVisible,
      });
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId ? { ...j, notes: [...(j.notes ?? []), res.data] } : j
        ),
      }));
      return res.data as JobNote;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add note";
      set({ error: message });
      throw new Error(message);
    }
  },

  addPart: async (jobId, data) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/parts`, data);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, partsUsed: [...(j.partsUsed ?? []), res.data] }
            : j
        ),
      }));
      return res.data as JobPart;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add part";
      set({ error: message });
      throw new Error(message);
    }
  },

  removePart: async (jobId, partId) => {
    set({ error: null });
    try {
      await api.delete(`/jobs/${jobId}/parts/${partId}`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                partsUsed: (j.partsUsed ?? []).filter((p) => p.id !== partId),
              }
            : j
        ),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove part";
      set({ error: message });
    }
  },

  addRepair: async (jobId, data) => {
    set({ error: null });
    try {
      const res = await api.post(`/jobs/${jobId}/repairs`, data);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? { ...j, repairs: [...(j.repairs ?? []), res.data] }
            : j
        ),
      }));
      return res.data as JobRepair;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add repair";
      set({ error: message });
      throw new Error(message);
    }
  },

  removeRepair: async (jobId, repairId) => {
    set({ error: null });
    try {
      await api.delete(`/jobs/${jobId}/repairs/${repairId}`);
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === jobId
            ? {
                ...j,
                repairs: (j.repairs ?? []).filter((r) => r.id !== repairId),
              }
            : j
        ),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove repair";
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
