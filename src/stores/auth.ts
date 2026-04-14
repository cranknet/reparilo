import type { RoleType } from "@shared/constants";
import { create } from "zustand";

interface AuthState {
  role: RoleType;
  setRole: (role: RoleType) => void;
  setUsername: (username: string) => void;
  username: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: "OWNER" as RoleType,
  setRole: (role) => set({ role }),
  username: "",
  setUsername: (username) => set({ username }),
}));
