import { AppError } from "@shared/errors/app-error.js";
import {
  createPartSchema,
  listPartsQuerySchema,
  togglePartStatusSchema,
  updatePartSchema,
} from "@shared/schemas/parts-catalog.schema";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createPart,
  remove as deletePart,
  getById as getPartById,
  list as listParts,
  toggleActive,
  update as updatePart,
} from "../services/parts-catalog.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const partsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const parsed = listPartsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          req.locale
        ),
      });
    }
    const result = await listParts(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const part = await getPartById(app.prisma, id);
    if (!part) {
      throw new AppError("PART_NOT_FOUND");
    }
    return reply.send(part);
  });

  app.post(
    "/",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const parsed = createPartSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const part = await createPart(app.prisma, parsed.data);
      return reply.status(201).send(part);
    }
  );

  app.patch(
    "/:id",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updatePartSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const result = await updatePart(app.prisma, id, parsed.data);
      if (!result) {
        throw new AppError("PART_NOT_FOUND");
      }
      return reply.send(result);
    }
  );

  app.patch(
    "/:id/status",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = togglePartStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const result = await toggleActive(app.prisma, id, parsed.data.isActive);
      if (!result) {
        throw new AppError("PART_NOT_FOUND");
      }
      return reply.send(result);
    }
  );

  app.delete(
    "/:id",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const result = await deletePart(app.prisma, id);
      if (!result) {
        throw new AppError("PART_NOT_FOUND");
      }
      return reply.status(204).send();
    }
  );
};
