import type { RoleType } from "@shared/constants";
import { create } from "zustand";
import i18n from "@/i18n";
import api, { getErrorMessage } from "@/lib/api";

interface UserRow {
  createdAt: string;
  email: string;
  id: string;
  image: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  name: string | null;
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
      const data = res.data;
      set({
        users: Array.isArray(data) ? data : (data.users ?? []),
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = getErrorMessage(err, i18n.t("errors.fetch_users"));
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
      const message = getErrorMessage(err, i18n.t("errors.create_user"));
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
      const message = getErrorMessage(err, i18n.t("errors.toggle_user_status"));
      set({ error: message });
    }
  },

  resetUserPassword: async (id, password) => {
    set({ error: null });
    try {
      await api.post(`/users/${id}/reset-password`, { password });
    } catch (err: unknown) {
      const message = getErrorMessage(err, i18n.t("errors.reset_password"));
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
