// TODO: i18n — validation messages below are hardcoded English strings.
// These schemas run on both server and client, so they need a shared
// i18n strategy before messages can be internationalized.
import { JobStatus, PartCategory, RepairCategory } from "@shared/constants";
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
  technicianId: z.string().min(1).optional(),
  isWarrantyReturn: z.boolean().optional(),
  warrantyForJobId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  reportedProblem: z.string().min(1).optional(),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0).optional(),
  estimatedDate: z.string().min(1).nullable().optional(),
  technicianId: z.string().min(1).nullable().optional(),
  color: z.string().optional(),
});

export const transitionStatusSchema = z.object({
  status: z.enum([
    JobStatus.INTAKE,
    JobStatus.WAITING_FOR_PARTS,
    JobStatus.IN_REPAIR,
    JobStatus.ON_HOLD,
    JobStatus.DONE,
    JobStatus.DELIVERED,
    JobStatus.RETURNED,
    JobStatus.CANCELLED,
  ]),
});

export const addJobPartSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().min(1),
  category: z.enum([
    PartCategory.SCREEN,
    PartCategory.BATTERY,
    PartCategory.CHARGING_PORT,
    PartCategory.CAMERA,
    PartCategory.SPEAKER,
    PartCategory.MICROPHONE,
    PartCategory.MOTHERBOARD,
    PartCategory.HOUSING,
    PartCategory.BUTTON,
    PartCategory.OTHER,
  ]),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  supplier: z.string().optional(),
});

export const addJobRepairSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum([
    RepairCategory.HARDWARE,
    RepairCategory.SOFTWARE,
    RepairCategory.DIAGNOSTIC,
    RepairCategory.OTHER,
  ]),
  price: z.number().min(0),
});

export const addJobNoteSchema = z.object({
  content: z.string().min(1),
  isCustomerVisible: z.boolean().default(false),
});

export const addWaitingPartSchema = z.object({
  partName: z.string().min(1),
  supplier: z.string().optional(),
});

export const jobListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  technicianId: z.string().optional(),
  search: z.string().optional(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
export type AddJobPartInput = z.infer<typeof addJobPartSchema>;
export type AddJobRepairInput = z.infer<typeof addJobRepairSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
export type AddWaitingPartInput = z.infer<typeof addWaitingPartSchema>;
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>;
