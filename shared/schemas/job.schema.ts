import { z } from 'zod';

export const createJobSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Phone number is required'),
  deviceBrand: z.string().min(1, 'Brand is required'),
  deviceModel: z.string().min(1, 'Model is required'),
  color: z.string().optional(),
  reportedProblem: z.string().min(1, 'Reported problem is required'),
  conditionNotes: z.string().optional(),
  estimatedCost: z.number().min(0, 'Cost must be positive'),
  estimatedDate: z.string().optional(),
  depositAmount: z.number().min(0).optional(),
  technicianId: z.string().optional(),
  isWarrantyReturn: z.boolean().optional(),
  warrantyForJobId: z.string().optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
