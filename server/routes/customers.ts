import {
  createCustomerSchema,
  customerListQuerySchema,
  customerSearchQuerySchema,
  updateCustomerSchema,
} from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createCustomer,
  getById,
  list as listCustomers,
  search as searchCustomers,
  update as updateCustomer,
} from "../services/customers.service.js";

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
export const customersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ customers: ["view"] }));

  app.post(
    "/",
    { preHandler: [requirePermission({ customers: ["create"] })] },
    async (req, reply) => {
      const parsed = createCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid customer data",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      try {
        const customer = await createCustomer(app.prisma, parsed.data);
        return reply.status(201).send(customer);
      } catch {
        return sendError(
          reply,
          500,
          "INTERNAL_ERROR",
          "Failed to create customer"
        );
      }
    }
  );

  app.patch(
    "/:id",
    { preHandler: [requirePermission({ customers: ["edit"] })] },
    async (req, reply) => {
      const parsed = updateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid customer data",
          { errors: parsed.error.flatten().fieldErrors }
        );
      }
      const { id } = req.params as { id: string };
      const updated = await updateCustomer(app.prisma, id, parsed.data);
      if (!updated) {
        return sendError(
          reply,
          404,
          "CUSTOMER_NOT_FOUND",
          "Customer not found"
        );
      }
      return reply.send(updated);
    }
  );

  app.get("/search", async (req, reply) => {
    const parsed = customerSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        { errors: parsed.error.flatten().fieldErrors }
      );
    }
    const results = await searchCustomers(app.prisma, parsed.data);
    return reply.send(results);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await getById(app.prisma, id);
    if (!customer) {
      return sendError(reply, 404, "CUSTOMER_NOT_FOUND", "Customer not found");
    }
    return reply.send(customer);
  });

  app.get("/", async (req, reply) => {
    const parsed = customerListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        { errors: parsed.error.flatten().fieldErrors }
      );
    }
    const result = await listCustomers(app.prisma, parsed.data);
    return reply.send(result);
  });
};
