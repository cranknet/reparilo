import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import { getById as getJobById } from "../services/job.service.js";
import { renderReceiptHtml } from "../services/receipt.service.js";

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

      const baseUrl =
        process.env.SHOP_PUBLIC_URL ??
        `http://localhost:${process.env.PORT ?? 4000}`;
      const html = await renderReceiptHtml(app.prisma, job, baseUrl);

      return reply
        .header("Content-Type", "text/html; charset=utf-8")
        .send(html);
    }
  );
};
