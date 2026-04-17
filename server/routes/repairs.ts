import {
  createRepairSchema,
  listRepairsQuerySchema,
  updateRepairSchema,
} from "@shared/schemas/repair-catalog.schema";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createRepair,
  getById as getRepairById,
  list as listRepairs,
  toggleActive,
  update as updateRepair,
} from "../services/repair-catalog.service.js";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return reply
    .status(status)
    .send({ error: code, message, details: details ?? {} });
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const repairCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ repairs: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const parsed = listRepairsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        { errors: parsed.error.flatten().fieldErrors }
      );
    }
    const result = await listRepairs(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const repair = await getRepairById(app.prisma, id);
    if (!repair) {
      return sendError(reply, 404, "REPAIR_NOT_FOUND", "Repair not found");
    }
    return reply.send(repair);
  });

  app.post(
    "/",
    { preHandler: [requirePermission({ repairs: ["manageCatalog"] })] },
    async (req, reply) => {
      const parsed = createRepairSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const repair = await createRepair(app.prisma, parsed.data);
      return reply.status(201).send(repair);
    }
  );

  app.patch(
    "/:id",
    { preHandler: [requirePermission({ repairs: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateRepairSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const result = await updateRepair(app.prisma, id, parsed.data);
      if (!result) {
        return sendError(reply, 404, "REPAIR_NOT_FOUND", "Repair not found");
      }
      return reply.send(result);
    }
  );

  app.patch(
    "/:id/status",
    { preHandler: [requirePermission({ repairs: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { isActive } = req.body as { isActive: boolean };
      if (typeof isActive !== "boolean") {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "isActive must be a boolean"
        );
      }
      const result = await toggleActive(app.prisma, id, isActive);
      if (!result) {
        return sendError(reply, 404, "REPAIR_NOT_FOUND", "Repair not found");
      }
      return reply.send(result);
    }
  );
};
