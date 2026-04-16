export type RepairCategoryType =
  | "HARDWARE"
  | "SOFTWARE"
  | "DIAGNOSTIC"
  | "OTHER";

export const RepairCategory: Record<string, RepairCategoryType> = {
  HARDWARE: "HARDWARE",
  SOFTWARE: "SOFTWARE",
  DIAGNOSTIC: "DIAGNOSTIC",
  OTHER: "OTHER",
};
