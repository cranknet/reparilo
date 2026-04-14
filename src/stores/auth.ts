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
  checkSession: () => Promise<void>;
  clearError: () => void;
  error: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  role: RoleType;
  user: AuthUser | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: "OWNER" as RoleType,
  error: null,

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get("/auth/session");
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
        role: "OWNER" as RoleType,
      });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/auth/sign-in/username", { username, password });
      const res = await api.get("/auth/session");
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
    } catch {
      undefined;
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      role: "OWNER" as RoleType,
      error: null,
    });
    window.location.href = "/login";
  },

  clearError: () => set({ error: null }),
}));
