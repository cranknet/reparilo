import { create } from "zustand";

interface UiState {
  closeIntakeModal: () => void;
  intakeModalOpen: boolean;
  openIntakeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  intakeModalOpen: false,

  openIntakeModal: () => set({ intakeModalOpen: true }),
  closeIntakeModal: () => set({ intakeModalOpen: false }),
}));
