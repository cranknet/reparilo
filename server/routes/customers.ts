import {
  createCustomerSchema,
  customerListQuerySchema,
  customerSearchQuerySchema,
} from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createCustomer,
  list as listCustomers,
  search as searchCustomers,
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
  app.addHook("preHandler", requirePermission("customers:read"));

  app.post(
    "/",
    { preHandler: [requirePermission("customers:write")] },
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
      const customer = await createCustomer(app.prisma, parsed.data);
      return reply.status(201).send(customer);
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
