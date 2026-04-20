import type { Customer } from "@shared/types";
import { create } from "zustand";
import i18n from "@/i18n";
import api from "@/lib/api";

interface CustomersState {
  clearError: () => void;
  error: string | null;
  isUpdating: boolean;
  updateCustomer: (
    id: string,
    data: { name?: string; phone?: string; email?: string }
  ) => Promise<Customer>;
}

export const useCustomersStore = create<CustomersState>((set) => ({
  error: null,
  isUpdating: false,

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
