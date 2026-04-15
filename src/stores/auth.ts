import type { RoleType } from "@shared/constants";
import { create } from "zustand";
import api from "@/lib/api";

interface AuthUser {
  id: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleType;
  username: string;
}

interface AuthState {
  checkSession: (forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
  error: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  role: RoleType;
  setRole: (role: RoleType) => void;
  user: AuthUser | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: "FRONT_DESK" as RoleType,
  error: null,

  checkSession: async (forceRefresh = false) => {
    set({ isLoading: true });
    try {
      const url = forceRefresh
        ? `/auth/get-session?_=${Date.now()}`
        : "/auth/get-session";
      const res = await api.get(url);
      const user = res.data.user;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        role: user.role as RoleType,
        error: null,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        role: "FRONT_DESK" as RoleType,
        error: null,
      });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/auth/sign-in/username", { username, password });
      const res = await api.get("/auth/get-session");
      const user = res.data.user;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        role: user.role as RoleType,
        error: null,
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; error?: string } };
      };
      const message =
        axiosErr.response?.data?.message ||
        axiosErr.response?.data?.error ||
        "Login failed";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/sign-out");
    } catch (_error) {
      // Intentionally ignored: clear local state regardless of API result
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      role: "FRONT_DESK" as RoleType,
      error: null,
    });
    window.location.href = "/login";
  },

  clearError: () => set({ error: null }),

  setRole: (role) => set({ role }),
}));
