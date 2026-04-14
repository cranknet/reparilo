// TODO: i18n — validation messages below are hardcoded English strings.
// These schemas run on both server and client, so they need a shared
// i18n strategy before messages can be internationalized.
import { z } from "zod";

export const createJobSchema = z.object({
  customerName: z.string().min(1, { error: "Enter a customer name" }),
  customerPhone: z.string().min(1, { error: "Enter a phone number" }),
  deviceBrand: z.string().min(1, { error: "Enter a device brand" }),
  deviceModel: z.string().min(1, { error: "Enter a device model" }),
  color: z.string().optional(),
  reportedProblem: z
    .string()
    .min(1, { error: "Describe the reported problem" }),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0, { error: "Enter a valid cost" }),
  estimatedDate: z.string().optional(),
  depositAmount: z
    .number()
    .min(0, { error: "Enter a valid deposit amount" })
    .optional(),
  technicianId: z.string().optional(),
  isWarrantyReturn: z.boolean().optional(),
  warrantyForJobId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
