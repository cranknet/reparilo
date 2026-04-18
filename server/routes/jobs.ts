import type { RoleType } from "@shared/constants/roles";
import {
  addJobNoteSchema,
  addJobPartSchema,
  addJobRepairSchema,
  addWaitingPartSchema,
  createJobSchema,
  jobListQuerySchema,
  transitionStatusSchema,
  updateJobSchema,
} from "@shared/schemas";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requirePermission } from "../middlewares/rbac.js";
import {
  create as createJob,
  getById as getJobById,
  getMetrics,
  list as listJobs,
  lookupByCode,
  transitionStatus,
  update as updateJob,
} from "../services/job.service.js";
import {
  add as addNote,
  list as listNotes,
} from "../services/job-notes.service.js";
import {
  add as addPart,
  remove as removePart,
} from "../services/job-parts.service.js";
import {
  remove as removePhoto,
  upload as uploadPhoto,
} from "../services/job-photos.service.js";
import {
  add as addRepair,
  remove as removeRepair,
} from "../services/job-repairs.service.js";
import {
  add as addWaitingPart,
  remove as removeWaitingPart,
} from "../services/job-waiting-parts.service.js";

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

function getUserId(req: FastifyRequest): string {
  const user = req.user;
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));

  // Public: no auth — used by customer self-tracking page
  app.get("/lookup", { preHandler: [] }, async (req, reply) => {
    const { code } = req.query as { code?: string };
    if (!code) {
      return reply.status(400).send({
        error: "MISSING_CODE",
        message: "code query parameter is required",
      });
    }
    const job = await lookupByCode(app.prisma, code);
    if (!job) {
      return reply
        .status(404)
        .send({ error: "JOB_NOT_FOUND", message: "Job not found" });
    }
    return reply.send(job);
  });

  app.get("/metrics", async (_req, reply) => {
    const metrics = await getMetrics(app.prisma);
    return reply.send(metrics);
  });

  app.get("/", async (req, reply) => {
    const parsed = jobListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "Invalid query parameters",
        {
          errors: parsed.error.flatten().fieldErrors,
        }
      );
    }
    const result = await listJobs(app.prisma, parsed.data);
    return reply.send(result);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await getJobById(app.prisma, id);
    if (!job) {
      return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    }
    return reply.send(job);
  });

  app.get("/:id/history", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await getJobById(app.prisma, id);
    if (!job) {
      return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    }
    const entries = await app.prisma.auditLog.findMany({
      where: { jobId: id },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(entries);
  });

  app.post(
    "/",
    { preHandler: [requirePermission({ jobs: ["create"] })] },
    async (req, reply) => {
      const parsed = createJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const result = await createJob(app.prisma, parsed.data, userId);
      if ("error" in result && result.error === "INVALID_CUSTOMER") {
        return sendError(reply, 400, "INVALID_CUSTOMER", "Customer not found");
      }
      if ("error" in result && result.error === "INVALID_WARRANTY_REFERENCE") {
        return sendError(
          reply,
          400,
          "INVALID_WARRANTY_REFERENCE",
          "Warranty reference must be a completed job for the same customer"
        );
      }
      return reply.status(201).send(result);
    }
  );

  app.patch(
    "/:id",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const result = await updateJob(app.prisma, id, parsed.data, userId);
      if (!result) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot update a job in terminal status"
        );
      }
      if ("error" in result && result.error === "INVALID_TECHNICIAN") {
        return sendError(
          reply,
          400,
          "INVALID_TECHNICIAN",
          "Assigned user is not a valid technician"
        );
      }
      return reply.send(result);
    }
  );

  app.patch("/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = transitionStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body", {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    if (!req.user) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication required");
    }

    const permCheck = await app.auth.api.userHasPermission({
      body: {
        role: req.user.role as RoleType,
        permissions: { jobStatus: [parsed.data.status] },
      },
    });
    if (!permCheck.success) {
      return sendError(
        reply,
        403,
        "FORBIDDEN_STATUS_TRANSITION",
        `Role ${req.user.role} cannot transition to ${parsed.data.status}`
      );
    }

    const userId = getUserId(req);
    const result = await transitionStatus(
      app.prisma,
      id,
      parsed.data.status,
      userId,
      {
        requestingRole: req.user.role as RoleType,
        reason: parsed.data.reason,
      }
    );
    if (!result) {
      return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    }
    if ("error" in result && result.error === "CONFLICT_STATUS_TRANSITION") {
      return sendError(
        reply,
        409,
        "CONFLICT_STATUS_TRANSITION",
        "Invalid status transition",
        {
          allowedTransitions: result.allowedTransitions,
          currentStatus: result.currentStatus,
        }
      );
    }
    if ("error" in result && result.error === "CANCEL_WINDOW_EXPIRED") {
      return sendError(
        reply,
        403,
        "CANCEL_WINDOW_EXPIRED",
        "Cancellation window has expired"
      );
    }
    if ("error" in result && result.error === "CANCEL_NOT_CREATOR") {
      return sendError(
        reply,
        403,
        "CANCEL_NOT_CREATOR",
        "Only the job creator can cancel"
      );
    }
    return reply.send(result);
  });

  app.get("/:id/notes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const notes = await listNotes(app.prisma, id);
    if (!notes) {
      return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
    }
    return reply.send(notes);
  });

  app.post(
    "/:id/notes",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = addJobNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const note = await addNote(app.prisma, id, parsed.data, userId);
      if (!note) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in note && note.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot add notes to a job in terminal status"
        );
      }
      return reply.status(201).send(note);
    }
  );

  app.post(
    "/:id/parts",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = addJobPartSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const result = await addPart(app.prisma, id, parsed.data, userId);
      if (!result) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot add parts to a job in terminal status"
        );
      }
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/:id/parts/:partId",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id, partId } = req.params as { id: string; partId: string };
      const userId = getUserId(req);
      const removed = await removePart(app.prisma, id, partId, userId);
      if (!removed) {
        return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Part not found");
      }
      return reply.status(204).send();
    }
  );

  app.post(
    "/:id/repairs",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = addJobRepairSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const result = await addRepair(app.prisma, id, parsed.data, userId);
      if (!result) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot add repairs to a job in terminal status"
        );
      }
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/:id/repairs/:repairId",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id, repairId } = req.params as { id: string; repairId: string };
      const userId = getUserId(req);
      const removed = await removeRepair(app.prisma, id, repairId, userId);
      if (!removed) {
        return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Repair not found");
      }
      return reply.status(204).send();
    }
  );

  app.post(
    "/:id/photos",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const data = await req.file();
      if (!data) {
        return sendError(reply, 400, "VALIDATION_ERROR", "No file uploaded");
      }
      const userId = getUserId(req);
      const result = await uploadPhoto(app.prisma, id, data, userId);
      if (!result) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "PHOTO_LIMIT_REACHED") {
        return sendError(
          reply,
          409,
          "PHOTO_LIMIT_REACHED",
          "Maximum number of photos reached"
        );
      }
      if ("error" in result && result.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot upload photos to a job in terminal status"
        );
      }
      if ("error" in result && result.error === "INVALID_FILE_TYPE") {
        return sendError(
          reply,
          400,
          "INVALID_FILE_TYPE",
          "Invalid file type. Allowed: JPEG, PNG, WebP"
        );
      }
      if ("error" in result && result.error === "INVALID_FILE_CONTENT") {
        return sendError(
          reply,
          400,
          "INVALID_FILE_CONTENT",
          "File content does not match the declared file type"
        );
      }
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/:id/photos/:photoId",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id, photoId } = req.params as { id: string; photoId: string };
      const userId = getUserId(req);
      const removed = await removePhoto(app.prisma, id, photoId, userId);
      if (!removed) {
        return sendError(reply, 404, "RESOURCE_NOT_FOUND", "Photo not found");
      }
      return reply.status(204).send();
    }
  );

  app.post(
    "/:id/waiting-parts",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = addWaitingPartSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(
          reply,
          400,
          "VALIDATION_ERROR",
          "Invalid request body",
          {
            errors: parsed.error.flatten().fieldErrors,
          }
        );
      }
      const userId = getUserId(req);
      const result = await addWaitingPart(app.prisma, id, parsed.data, userId);
      if (!result) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      if ("error" in result && result.error === "JOB_IN_TERMINAL_STATUS") {
        return sendError(
          reply,
          409,
          "JOB_IN_TERMINAL_STATUS",
          "Cannot add waiting parts to a job in terminal status"
        );
      }
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/:id/waiting-parts/:waitingId",
    { preHandler: [requirePermission({ jobs: ["edit"] })] },
    async (req, reply) => {
      const { id, waitingId } = req.params as { id: string; waitingId: string };
      const userId = getUserId(req);
      const removed = await removeWaitingPart(
        app.prisma,
        id,
        waitingId,
        userId
      );
      if (!removed) {
        return sendError(
          reply,
          404,
          "RESOURCE_NOT_FOUND",
          "Waiting part not found"
        );
      }
      return reply.status(204).send();
    }
  );
};
