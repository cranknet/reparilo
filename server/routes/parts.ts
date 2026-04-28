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
import { sendError } from "../utils/send-error.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const partsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ parts: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const parsed = listPartsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        }
      );
    }
    const result = await listParts(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const part = await getPartById(app.prisma, id);
    if (!part) {
      return sendError(reply, 404, "PART_NOT_FOUND", "Part not found");
    }
    return reply.send(part);
  });

  app.post(
    "/",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const parsed = createPartSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
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
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
      }
      const result = await updatePart(app.prisma, id, parsed.data);
      if (!result) {
        return sendError(reply, 404, "PART_NOT_FOUND", "Part not found");
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
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
      }
      const result = await toggleActive(app.prisma, id, parsed.data.isActive);
      if (!result) {
        return sendError(reply, 404, "PART_NOT_FOUND", "Part not found");
      }
      return reply.send(result);
    }
  );

  app.delete(
    "/:id",
    { preHandler: [requirePermission({ parts: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        const result = await deletePart(app.prisma, id);
        if (!result) {
          return sendError(reply, 404, "PART_NOT_FOUND", "Part not found");
        }
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof Error && err.message.includes("referenced by")) {
          return sendError(
            reply,
            409,
            "PART_IN_USE",
            "Part is referenced by existing jobs. Deactivate it instead."
          );
        }
        req.log.error(err);
        return sendError(reply, 500, "INTERNAL_ERROR", "Internal server error");
      }
    }
  );
};
