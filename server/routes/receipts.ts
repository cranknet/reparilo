import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { getById as getJobById } from "../services/job.service.js";
import {
  renderLabelHtml,
  renderReceiptHtml,
} from "../services/receipt.service.js";

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string
) {
  return reply.status(status).send({ code, error: message });
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const receiptRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/:id/receipt",
    { preHandler: [requirePermission({ jobs: ["view"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const job = await getJobById(app.prisma, id);
      if (!job) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }

      let baseUrl = process.env.SHOP_PUBLIC_URL;
      if (!baseUrl) {
        app.log.warn(
          "SHOP_PUBLIC_URL is not set — receipt QR and tracking link will not work in production"
        );
        baseUrl = `http://localhost:${process.env.PORT ?? 4000}`;
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
      const { id } = req.params as { id: string };
      const job = await getJobById(app.prisma, id);
      if (!job) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }

      let baseUrl = process.env.SHOP_PUBLIC_URL;
      if (!baseUrl) {
        app.log.warn(
          "SHOP_PUBLIC_URL is not set — label QR and tracking link will not work in production"
        );
        baseUrl = `http://localhost:${process.env.PORT ?? 4000}`;
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
