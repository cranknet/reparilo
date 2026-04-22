import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  undoAction?: () => void;
  undoable: boolean;
  undoLabel?: string;
}

interface ToastState {
  dismiss: (id: string) => void;
  toast: (message: string, type?: ToastType) => void;
  toasts: ToastItem[];
  undoToast: (
    message: string,
    undoLabel: string,
    undoAction: () => void
  ) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

const nextId = () => crypto.randomUUID();

const UNDO_DURATION = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  toast: (message, type = "success") => {
    const id = nextId();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, undoable: false }],
    }));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        get().dismiss(id);
      }, 4000)
    );
  },

  undoToast: (message, undoLabel, undoAction) => {
    const id = nextId();
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id, message, type: "info", undoLabel, undoAction, undoable: true },
      ],
    }));
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        get().dismiss(id);
      }, UNDO_DURATION)
    );
  },

  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
