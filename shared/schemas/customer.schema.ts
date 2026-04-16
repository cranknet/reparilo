import { z } from "zod";

export const customerListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const customerSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
export type CustomerSearchQueryInput = z.infer<
  typeof customerSearchQuerySchema
>;
