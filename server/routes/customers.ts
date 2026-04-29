import { AppError } from "@shared/errors/app-error.js";
import {
  createCustomerSchema,
  customerIdParamSchema,
  customerListQuerySchema,
  customerSearchQuerySchema,
  updateCustomerSchema,
} from "@shared/schemas";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createCustomer,
  getById,
  list as listCustomers,
  search as searchCustomers,
  update as updateCustomer,
} from "../services/customers.service.js";
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const customersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ customers: ["view"] }));

  app.post(
    "/",
    { preHandler: [requirePermission({ customers: ["create"] })] },
    async (req, reply) => {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const customer = await createCustomer(app.prisma, parsed.data);
      return reply.status(201).send(customer);
    }
  );

  app.patch(
    "/:id",
    { preHandler: [requirePermission({ customers: ["edit"] })] },
    async (req, reply) => {
      const parsed = updateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
        });
      }
      const { id } = req.params as { id: string };
      const updated = await updateCustomer(app.prisma, id, parsed.data);
      if (!updated) {
        throw new AppError("CUSTOMER_NOT_FOUND");
      }
      return reply.send(updated);
    }
  );

  app.get("/search", async (req, reply) => {
    const parsed = customerSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          req.locale
        ),
      });
    }
    const results = await searchCustomers(app.prisma, parsed.data);
    return reply.send(results);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = customerIdParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new AppError("INVALID_CUSTOMER_ID");
    }
    const customer = await getById(app.prisma, id);
    if (!customer) {
      throw new AppError("CUSTOMER_NOT_FOUND");
    }
    return reply.send(customer);
  });

  app.get("/", async (req, reply) => {
    const parsed = customerListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          req.locale
        ),
      });
    }
    const result = await listCustomers(app.prisma, parsed.data);
    return reply.send(result);
  });
};
