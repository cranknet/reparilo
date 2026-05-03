import { create } from "zustand";

interface UiState {
  closeIntakeModal: () => void;
  closeMoreSheet: () => void;
  closePrintPreview: () => void;
  intakeModalOpen: boolean;
  moreSheetOpen: boolean;
  openIntakeModal: () => void;
  openMoreSheet: () => void;
  printPreviewJobId: string | null;
  showPrintPreview: (jobId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  intakeModalOpen: false,
  moreSheetOpen: false,
  printPreviewJobId: null,

  openIntakeModal: () => set({ intakeModalOpen: true }),
  closeIntakeModal: () => set({ intakeModalOpen: false }),
  openMoreSheet: () => set({ moreSheetOpen: true }),
  closeMoreSheet: () => set({ moreSheetOpen: false }),
  showPrintPreview: (jobId: string) => set({ printPreviewJobId: jobId }),
  closePrintPreview: () => set({ printPreviewJobId: null }),
}));
