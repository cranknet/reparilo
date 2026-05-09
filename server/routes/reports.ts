import { AppError } from "@shared/errors/app-error.js";
import { reportsQuerySchema } from "@shared/schemas/reports.schema.js";
import type { FastifyPluginAsync } from "fastify";
import { dashboardScope } from "../middlewares/dashboard-scope.js";
import { requirePermission } from "../middlewares/rbac.js";
import {
  insightsReport,
  operationsReport,
  resolveRange,
  revenueReport,
} from "../services/reports.service.js";
import { getRole } from "../utils/request.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/revenue",
    {
      preHandler: [
        requirePermission({ reports: ["viewShop"] }),
        dashboardScope,
      ],
      schema: { tags: ["reports"], summary: "Revenue & financial report" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      const marginResult = await req.server.auth.api.userHasPermission({
        body: {
          role: getRole(req),
          permissions: { reports: ["viewMargin"] },
        },
      });

      return revenueReport(
        app.prisma,
        scope,
        range,
        marginResult?.success === true
      );
    }
  );

  app.get(
    "/operations",
    {
      preHandler: [
        requirePermission({ reports: ["viewSelf"] }),
        dashboardScope,
      ],
      schema: { tags: ["reports"], summary: "Repair operations report" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      const shopResult = await req.server.auth.api.userHasPermission({
        body: {
          role: getRole(req),
          permissions: { reports: ["viewShop"] },
        },
      });

      return operationsReport(
        app.prisma,
        scope,
        range,
        shopResult?.success === true
      );
    }
  );

  app.get(
    "/insights",
    {
      preHandler: [
        requirePermission({ reports: ["viewShop"] }),
        dashboardScope,
      ],
      schema: { tags: ["reports"], summary: "Customer insights report" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const parsed = reportsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", {
          issues: parsed.error.issues,
        });
      }
      const q = parsed.data;
      const range = resolveRange(q.range, q.from, q.to, scope.shopTz);

      return await insightsReport(app.prisma, scope, range);
    }
  );
};
