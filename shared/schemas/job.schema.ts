import { z } from "zod";

export const createJobSchema = z.object({
	customerName: z.string().min(1, { error: "Customer name is required" }),
	customerPhone: z.string().min(1, { error: "Phone number is required" }),
	deviceBrand: z.string().min(1, { error: "Brand is required" }),
	deviceModel: z.string().min(1, { error: "Model is required" }),
	color: z.string().optional(),
	reportedProblem: z.string().min(1, { error: "Reported problem is required" }),
	conditionNotes: z.string().optional(),
	estimatedCost: z.number().min(0, { error: "Cost must be positive" }),
	estimatedDate: z.string().optional(),
	depositAmount: z
		.number()
		.min(0, { error: "Deposit must be positive" })
		.optional(),
	technicianId: z.string().optional(),
	isWarrantyReturn: z.boolean().optional(),
	warrantyForJobId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
