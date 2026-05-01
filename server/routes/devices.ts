import { AppError } from "@shared/errors/app-error.js";
import {
  brandIdParamSchema,
  brandSearchQuerySchema,
  createBrandSchema,
  createModelSchema,
  modelSearchQuerySchema,
} from "@shared/schemas/device.schema";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  createBrand,
  createModel,
  searchBrands,
  searchModels,
} from "../services/device.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const devicesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));

  app.get(
    "/search",
    {
      schema: {
        tags: ["brands"],
        summary: "Search brands",
        querystring: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      const parsed = brandSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const brands = await searchBrands(app.prisma, parsed.data);
      return reply.send({ brands });
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["brands"],
        summary: "Create brand",
        body: { type: "object", additionalProperties: true },
      },
      preHandler: [requirePermission({ jobs: ["create"] })],
    },
    async (req, reply) => {
      const parsed = createBrandSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const brand = await createBrand(app.prisma, parsed.data);
      return reply.status(201).send(brand);
    }
  );

  app.get(
    "/:brandId/models/search",
    {
      schema: {
        tags: ["brands"],
        summary: "Search models for a brand",
        querystring: { type: "object", additionalProperties: true },
        params: {
          type: "object",
          properties: { brandId: { type: "string" } },
          required: ["brandId"],
        },
      },
    },
    async (req, reply) => {
      const { brandId } = req.params as { brandId: string };
      const paramParsed = brandIdParamSchema.safeParse(brandId);
      if (!paramParsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: { brandId: ["Invalid brand ID format"] },
        });
      }
      const parsed = modelSearchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const models = await searchModels(app.prisma, brandId, parsed.data);
      return reply.send({ models });
    }
  );

  app.post(
    "/:brandId/models",
    {
      schema: {
        tags: ["brands"],
        summary: "Create model for a brand",
        body: { type: "object", additionalProperties: true },
        params: {
          type: "object",
          properties: { brandId: { type: "string" } },
          required: ["brandId"],
        },
      },
      preHandler: [requirePermission({ jobs: ["create"] })],
    },
    async (req, reply) => {
      const { brandId } = req.params as { brandId: string };
      const paramParsed = brandIdParamSchema.safeParse(brandId);
      if (!paramParsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: { brandId: ["Invalid brand ID format"] },
        });
      }
      const parsed = createModelSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const device = await createModel(app.prisma, brandId, parsed.data);
      return reply.status(201).send(device);
    }
  );
};
