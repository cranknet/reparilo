import { z } from "zod";

export const signInSchema = z.object({
  username: z.string().min(1, "validations.required"),
  password: z.string().min(8, "validations.password_min"),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern"),
  email: z.string().email("validations.email"),
  password: z.string().min(8, "validations.password_min"),
  role: z.enum(["OWNER", "TECHNICIAN", "FRONT_DESK"]),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, "validations.password_min"),
  newPassword: z.string().min(8, "validations.password_min"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "validations.required").max(100).optional(),
  email: z.string().email("validations.email").optional(),
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern")
    .optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "validations.password_min"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "validations.required").max(100).optional(),
  email: z.string().email("validations.email").optional(),
  username: z
    .string()
    .min(3, "validations.username_min")
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "validations.username_pattern")
    .optional(),
  role: z.enum(["OWNER", "TECHNICIAN", "FRONT_DESK"]).optional(),
  isActive: z.boolean().optional(),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const activityListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(4),
});

export const userIdParamSchema = z.string().cuid();

export type SignInInput = z.infer<typeof signInSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;
export type ActivityListQueryInput = z.infer<typeof activityListQuerySchema>;
