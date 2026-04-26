import { z } from "zod";

export const jobIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type JobIdParamInput = z.infer<typeof jobIdParamSchema>;
