import { RepairCategory } from "@shared/constants";
import { z } from "zod";

export const createRepairSchema = z.object({
  name: z.string().min(1, "validations.repair_name_required"),
  category: z.enum([
    RepairCategory.HARDWARE,
    RepairCategory.SOFTWARE,
    RepairCategory.DIAGNOSTIC,
    RepairCategory.OTHER,
  ]),
  defaultPrice: z
    .number()
    .min(0, "validations.price_positive")
    .max(99_999_999.99),
});

export const updateRepairSchema = z.object({
  name: z.string().min(1).optional(),
  category: z
    .enum([
      RepairCategory.HARDWARE,
      RepairCategory.SOFTWARE,
      RepairCategory.DIAGNOSTIC,
      RepairCategory.OTHER,
    ])
    .optional(),
  defaultPrice: z.number().min(0).max(99_999_999.99).optional(),
  isActive: z.boolean().optional(),
});

export const listRepairsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type UpdateRepairInput = z.infer<typeof updateRepairSchema>;
export type ListRepairsQueryInput = z.infer<typeof listRepairsQuerySchema>;
