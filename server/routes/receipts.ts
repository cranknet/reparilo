import { AppError } from "@shared/errors/app-error.js";
import { jobIdParamSchema } from "@shared/schemas/receipt.schema";
import type { FastifyPluginAsync } from "fastify";
import { resolveUrls } from "../config/env.js";
import { requirePermission } from "../middlewares/rbac.js";
import { getById as getJobById } from "../services/job.service.js";
import {
  renderLabelHtml,
  renderReceiptHtml,
} from "../services/receipt.service.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const receiptRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/:id/receipt",
    { preHandler: [requirePermission({ jobs: ["view"] })] },
    async (req, reply) => {
      const paramParsed = jobIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      const { id } = paramParsed.data;
      const job = await getJobById(app.prisma, id);
      if (!job) {
        throw new AppError("JOB_NOT_FOUND");
      }

      const { appUrl: baseUrl } = resolveUrls();
      if (!baseUrl) {
        app.log.warn(
          "APP_URL is not set — receipt QR and tracking link will not work"
        );
      }

      const costPerm = await req.server.auth.api.userHasPermission({
        body: {
          role: req.user?.role as import("@shared/constants/roles").RoleType,
          permissions: { parts: ["viewCost"] },
        },
      });
      const html = await renderReceiptHtml(app.prisma, job, baseUrl, {
        hideCosts: !costPerm.success,
      });

      return reply
        .header("Content-Type", "text/html; charset=utf-8")
        .send(html);
    }
  );

  app.get(
    "/:id/label",
    { preHandler: [requirePermission({ jobs: ["view"] })] },
    async (req, reply) => {
      const paramParsed = jobIdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        throw new AppError("VALIDATION_ERROR");
      }
      const { id } = paramParsed.data;
      const job = await getJobById(app.prisma, id);
      if (!job) {
        throw new AppError("JOB_NOT_FOUND");
      }

      const { appUrl: baseUrl } = resolveUrls();
      if (!baseUrl) {
        app.log.warn(
          "APP_URL is not set — label QR and tracking link will not work"
        );
      }

      const costPerm = await req.server.auth.api.userHasPermission({
        body: {
          role: req.user?.role as import("@shared/constants/roles").RoleType,
          permissions: { parts: ["viewCost"] },
        },
      });
      const html = await renderLabelHtml(app.prisma, job, baseUrl, {
        hideCosts: !costPerm.success,
      });

      return reply
        .header("Content-Type", "text/html; charset=utf-8")
        .send(html);
    }
  );
};
