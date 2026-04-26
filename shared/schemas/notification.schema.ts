import { z } from "zod";

export const templateIdParamSchema = z.object({
  templateId: z.string().cuid(),
});

export type TemplateIdParamInput = z.infer<typeof templateIdParamSchema>;
