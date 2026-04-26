import { z } from "zod";

export const createCustomerSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  name: z.string().min(1, { error: "Enter a customer name" }),
  phone: z.string().min(1, { error: "Enter a phone number" }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().min(1, { error: "Enter a customer name" }).optional(),
  phone: z.string().min(1, { error: "Enter a phone number" }).optional(),
  email: z.string().email().or(z.literal("")).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const customerListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const customerSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const customerIdParamSchema = z.string().cuid();

export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
export type CustomerSearchQueryInput = z.infer<
  typeof customerSearchQuerySchema
>;
