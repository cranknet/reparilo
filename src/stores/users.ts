import type { RoleType } from "@shared/constants";
import { create } from "zustand";
import api from "@/lib/api";

interface UserRow {
  createdAt: string;
  email: string;
  id: string;
  image: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: RoleType;
  username: string;
}

interface UsersState {
  clearError: () => void;
  createUser: (data: {
    username: string;
    email: string;
    password: string;
    role: RoleType;
  }) => Promise<UserRow>;
  error: string | null;

  fetchUsers: () => Promise<void>;
  isLoading: boolean;
  resetUserPassword: (id: string, password: string) => Promise<void>;
  toggleUserStatus: (id: string, isActive: boolean) => Promise<void>;
  updateUserAvatar: (id: string, imagePath: string | null) => void;
  users: UserRow[];
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/users");
      set({ users: res.data, isLoading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch users";
      set({ isLoading: false, error: message });
    }
  },

  createUser: async (data) => {
    set({ error: null });
    try {
      const res = await api.post("/users", data);
      const newUser = res.data as UserRow;
      set((state) => ({ users: [newUser, ...state.users] }));
      return newUser;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create user";
      set({ error: message });
      throw new Error(message);
    }
  },

  toggleUserStatus: async (id, isActive) => {
    set({ error: null });
    try {
      const res = await api.patch(`/users/${id}/status`, { isActive });
      const updated = res.data as UserRow;
      set((state) => ({
        users: state.users.map((u) => (u.id === id ? updated : u)),
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle user status";
      set({ error: message });
    }
  },

  resetUserPassword: async (id, password) => {
    set({ error: null });
    try {
      await api.post(`/users/${id}/reset-password`, { password });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reset password";
      set({ error: message });
      throw new Error(message);
    }
  },

  updateUserAvatar: (id, imagePath) => {
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, image: imagePath } : u
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
