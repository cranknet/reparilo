import { AppError } from "@shared/errors/app-error.js";
import {
  createRepairSchema,
  listRepairsQuerySchema,
  updateRepairSchema,
} from "@shared/schemas/repair-catalog.schema";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createRepair,
  remove as deleteRepair,
  getById as getRepairById,
  list as listRepairs,
  toggleActive,
  update as updateRepair,
} from "../services/repair-catalog.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const repairCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ repairs: ["viewCatalog"] }));

  app.get("/", async (req, reply) => {
    const parsed = listRepairsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          req.locale
        ),
      });
    }
    const result = await listRepairs(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const repair = await getRepairById(app.prisma, id);
    if (!repair) {
      throw new AppError("REPAIR_NOT_FOUND");
    }
    return reply.send(repair);
  });

  app.post(
    "/",
    { preHandler: [requirePermission({ repairs: ["manageCatalog"] })] },
    async (req, reply) => {
      const parsed = createRepairSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
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
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const result = await updateRepair(app.prisma, id, parsed.data);
      if (!result) {
        throw new AppError("REPAIR_NOT_FOUND");
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
        throw new AppError("VALIDATION_ERROR");
      }
      const result = await toggleActive(app.prisma, id, isActive);
      if (!result) {
        throw new AppError("REPAIR_NOT_FOUND");
      }
      return reply.send(result);
    }
  );

  app.delete(
    "/:id",
    { preHandler: [requirePermission({ repairs: ["manageCatalog"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const result = await deleteRepair(app.prisma, id);
      if (!result) {
        throw new AppError("REPAIR_NOT_FOUND");
      }
      return reply.status(204).send();
    }
  );
};
