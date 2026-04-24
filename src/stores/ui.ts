import { create } from "zustand";

interface UiState {
  closeIntakeModal: () => void;
  closeMoreSheet: () => void;
  intakeModalOpen: boolean;
  moreSheetOpen: boolean;
  openIntakeModal: () => void;
  openMoreSheet: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  intakeModalOpen: false,
  moreSheetOpen: false,

  openIntakeModal: () => set({ intakeModalOpen: true }),
  closeIntakeModal: () => set({ intakeModalOpen: false }),
  openMoreSheet: () => set({ moreSheetOpen: true }),
  closeMoreSheet: () => set({ moreSheetOpen: false }),
}));
