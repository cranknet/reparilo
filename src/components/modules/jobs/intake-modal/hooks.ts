import type { RepairCatalog } from "@shared/types";
import { useCallback } from "react";
import type { IntakeFormData } from "./types";

export function useRepairHandlers(
  setForm: React.Dispatch<React.SetStateAction<IntakeFormData>>
) {
  const handleSelectRepair = useCallback(
    (repair: RepairCatalog) => {
      setForm((prev) => ({
        ...prev,
        repairs: [
          ...prev.repairs,
          {
            repairId: repair.id,
            repairName: repair.name,
            category: repair.category,
            price: Number(repair.defaultPrice),
          },
        ],
      }));
    },
    [setForm]
  );

  const handleRemoveRepair = useCallback(
    (index: number) => {
      setForm((prev) => ({
        ...prev,
        repairs: prev.repairs.filter((_, i) => i !== index),
      }));
    },
    [setForm]
  );

  const handleRepairPriceChange = useCallback(
    (index: number, newPrice: number) => {
      setForm((prev) => ({
        ...prev,
        repairs: prev.repairs.map((r, i) =>
          i === index ? { ...r, price: Number(newPrice) || 0 } : r
        ),
      }));
    },
    [setForm]
  );

  return { handleSelectRepair, handleRemoveRepair, handleRepairPriceChange };
}
