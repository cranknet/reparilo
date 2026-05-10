import { z } from "zod";

export const FaultCategoryEnum = z.enum([
  "WORKMANSHIP",
  "DEFECTIVE_PART",
  "MISDIAGNOSIS",
]);

export const ResolutionOutcomeEnum = z.enum([
  "REWORK_FREE",
  "REWORK_PARTIAL_CHARGE",
  "REFUND_PARTIAL",
  "REFUND_FULL",
]);

export const ReturnClaimStatusEnum = z.enum(["OPEN", "RESOLVED"]);

export const PhotoStageEnum = z.enum(["RETURN_INTAKE", "RETURN_RESOLUTION"]);

export const createReturnClaimSchema = z.object({
  originalJobId: z.string().min(1),
  claimedJobRepairId: z.string().min(1).optional(),
  claimedJobPartId: z.string().min(1).optional(),
  returnReason: z.string().min(1).max(2000),
});

export const triageReturnClaimSchema = z.object({
  faultCategory: FaultCategoryEnum,
});

export const resolveReturnClaimSchema = z
  .object({
    resolutionOutcome: ResolutionOutcomeEnum,
    partialChargeAmount: z.number().positive().optional(),
    refundAmount: z.number().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.resolutionOutcome === "REWORK_PARTIAL_CHARGE" &&
      val.partialChargeAmount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["partialChargeAmount"],
        message: "partialChargeAmount is required for REWORK_PARTIAL_CHARGE",
      });
    }
    if (
      (val.resolutionOutcome === "REFUND_PARTIAL" ||
        val.resolutionOutcome === "REFUND_FULL") &&
      val.refundAmount === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refundAmount"],
        message: "refundAmount is required for refund outcomes",
      });
    }
  });

export const listReturnClaimsQuerySchema = z.object({
  status: ReturnClaimStatusEnum.optional(),
  faultCategory: FaultCategoryEnum.optional(),
  resolutionOutcome: ResolutionOutcomeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  originalJobId: z.string().optional(),
  technicianId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadClaimPhotoSchema = z.object({
  stage: PhotoStageEnum,
});
