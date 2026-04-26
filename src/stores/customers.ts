import type { Customer } from "@shared/types";
import { create } from "zustand";
import i18n from "@/i18n";
import api from "@/lib/api";

interface CustomerJob {
  createdAt: string;
  deviceModel: string;
  estimatedCost: number;
  finalCost: number;
  id: string;
  jobCode: string;
  reportedProblem: string;
  status: string;
}

interface CustomerDetail {
  createdAt: string;
  email: string | null;
  id: string;
  jobs: CustomerJob[];
  name: string;
  phone: string;
  updatedAt: string;
}

interface CustomerListItem {
  _count: { jobs: number };
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

interface CustomersState {
  clearError: () => void;
  currentCustomer: CustomerDetail | null;
  customers: CustomerListItem[];
  error: string | null;
  fetchCustomer: (id: string) => Promise<void>;
  isLoading: boolean;
  isLoadingCustomer: boolean;
  isUpdating: boolean;
  nextCursor: string | null;
  searchCustomers: (query: string) => Promise<CustomerListItem[]>;
  totalCount: number;
  updateCustomer: (
    id: string,
    data: { name?: string; phone?: string; email?: string }
  ) => Promise<Customer>;
}

export const useCustomersStore = create<CustomersState>((set) => ({
  customers: [],
  currentCustomer: null,
  error: null,
  isLoading: false,
  isLoadingCustomer: false,
  isUpdating: false,
  nextCursor: null,
  totalCount: 0,

  searchCustomers: async (query) => {
    try {
      const res = await api.get("/customers/search", {
        params: { q: query, limit: 20 },
      });
      return res.data as CustomerListItem[];
    } catch {
      return [];
    }
  },

  fetchCustomer: async (id) => {
    set({ isLoadingCustomer: true, error: null });
    try {
      const res = await api.get(`/customers/${id}`);
      set({
        currentCustomer: res.data as CustomerDetail,
        isLoadingCustomer: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load customer";
      set({ isLoadingCustomer: false, error: message });
    }
  },

  updateCustomer: async (id, data) => {
    set({ isUpdating: true, error: null });
    try {
      const res = await api.patch(`/customers/${id}`, data);
      return res.data as Customer;
    } catch (err: unknown) {
      let message = i18n.t("errors.update_customer");
      if (err && typeof err === "object" && "response" in err) {
        const resp = (err as { response?: { data?: { message?: string } } })
          .response;
        if (resp?.data?.message) {
          message = resp.data.message;
        }
      }
      set({ error: message, isUpdating: false });
      throw new Error(message);
    } finally {
      set({ isUpdating: false });
    }
  },

  clearError: () => set({ error: null }),
}));
