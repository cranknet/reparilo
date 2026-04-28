import { JobStatus, PartCategory, RepairCategory } from "@shared/constants";
import { z } from "zod";

const repairCategoryValues = Object.values(RepairCategory) as [
  string,
  ...string[],
];

export const intakeRepairItemSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum(repairCategoryValues),
  price: z.number().min(0).max(99_999_999.99),
});

export const createJobSchema = z.object({
  customerEmail: z
    .string()
    .email({ error: "validations.email" })
    .optional()
    .or(z.literal("")),
  customerId: z.string().cuid().optional(),
  customerName: z.string().min(1, { error: "validations.enter_name" }),
  customerPhone: z.string().min(1, { error: "validations.enter_phone" }),
  deviceBrand: z.string().min(1, { error: "validations.enter_brand" }),
  deviceModel: z.string().min(1, { error: "validations.enter_model" }),
  color: z.string().optional(),
  reportedProblem: z.string().min(1, { error: "validations.describe_problem" }),
  conditionNotes: z.string().optional(),
  estimatedCost: z
    .number()
    .min(0, { error: "validations.valid_cost" })
    .max(99_999_999.99),
  estimatedDate: z.string().optional(),
  depositAmount: z
    .number()
    .min(0, { error: "validations.valid_deposit" })
    .max(99_999_999.99)
    .optional(),
  technicianId: z.string().min(1).optional(),
  isWarrantyReturn: z.boolean().optional(),
  warrantyForJobId: z.string().optional(),
  repairs: z.array(intakeRepairItemSchema).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  reportedProblem: z.string().min(1).optional(),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0).max(99_999_999.99).optional(),
  estimatedDate: z.string().min(1).nullable().optional(),
  depositAmount: z.number().min(0).max(99_999_999.99).nullable().optional(),
  technicianId: z.string().min(1).nullable().optional(),
  color: z.string().optional(),
});

export const transitionStatusSchema = z
  .object({
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
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    const requiresReason =
      val.status === JobStatus.CANCELLED || val.status === JobStatus.ON_HOLD;
    if (requiresReason && (!val.reason || val.reason.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "validations.reason_required",
      });
    }
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
  unitPrice: z.number().min(0).max(99_999_999.99),
  quantity: z.number().int().min(1).max(10_000).default(1),
  supplier: z.string().optional(),
});

export const addJobRepairSchema = z.object({
  repairId: z.string().optional(),
  repairName: z.string().min(1),
  category: z.enum(repairCategoryValues),
  price: z.number().min(0).max(99_999_999.99),
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
export type IntakeRepairItem = z.infer<typeof intakeRepairItemSchema>;
