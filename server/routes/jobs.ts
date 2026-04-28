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
import type { DashboardTarget } from "../lib/dashboard-events.js";
import { emitDashboardChanged } from "../lib/dashboard-events.js";
import { requirePermission } from "../middlewares/rbac.js";
import {
  computeMargin,
  create as createJob,
  getById as getJobById,
  getMetrics,
  list as listJobs,
  lookupByCode,
  lookupByCodeAuth,
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
import { resolveZodErrors } from "../utils/resolve-validation-messages.js";

const JOB_CODE_RE = /^[A-Za-z0-9-]+$/;
const PHONE4_RE = /^\d{4}$/;

interface LockoutEntry {
  failures: number;
  lockedUntil: number;
}

function sendNotFound(reply: FastifyReply) {
  return reply
    .status(404)
    .send({ error: "JOB_NOT_FOUND", message: "Job not found" });
}

function validateLookupParams(
  code: string | undefined,
  phone4: string | undefined
): ((reply: FastifyReply) => unknown) | null {
  if (!(code && phone4)) {
    return (reply) =>
      reply.status(400).send({
        error: "MISSING_CODE",
        message: "code and phone4 query parameters are required",
      });
  }
  if (code.length > 50 || !JOB_CODE_RE.test(code)) {
    return (reply) =>
      reply.status(400).send({
        error: "INVALID_CODE",
        message: "Invalid job code format",
      });
  }
  if (!PHONE4_RE.test(phone4)) {
    return (reply) =>
      reply.status(400).send({
        error: "INVALID_PHONE4",
        message: "phone4 must be exactly 4 digits",
      });
  }
  return null;
}

function trackFailedAttempt(lockouts: Map<string, LockoutEntry>, code: string) {
  const existing = lockouts.get(code) ?? { failures: 0, lockedUntil: 0 };
  existing.failures += 1;
  if (existing.failures >= 5) {
    existing.lockedUntil = Date.now() + 60 * 60 * 1000;
  }
  lockouts.set(code, existing);
}

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

function jobDashboardTargets(result: {
  technicianId?: string | null;
}): DashboardTarget[] {
  const targets: DashboardTarget[] = ["OWNER", "FRONT_DESK"];
  if (result.technicianId) {
    targets.push({ technicianId: result.technicianId });
  }
  return targets;
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requirePermission({ jobs: ["view"] }));

  // In-memory lockout store: jobCode → { failures, lockedUntil }
  // NOTE: This is per-process state — it will NOT be shared across multiple
  // server instances. For Reparilo's single-location deployment (one server)
  // this is acceptable. If multi-instance deployment is ever needed, this
  // should be replaced with a Redis or DB-backed store.
  // TODO: Migrate to Redis/DB-backed store for multi-instance support.
  const codeLockouts = new Map<
    string,
    { failures: number; lockedUntil: number }
  >();
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [key, val] of codeLockouts) {
        if (val.lockedUntil > 0 && val.lockedUntil <= now) {
          codeLockouts.delete(key);
        }
      }
    },
    15 * 60 * 1000
  );
  // Prevent cleanup from keeping the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  // Public: no auth — used by customer self-tracking page
  // Per-IP rate limit: 10 attempts / 15 min (generous for shared NAT)
  app.get("/lookup", {
    preHandler: [],
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 15 * 60 * 1000, // 15 min
        keyGenerator: (req: FastifyRequest) => (req.ip as string) ?? "unknown",
      },
    },
    handler: async (req, reply) => {
      const { code, phone4 } = req.query as {
        code?: string;
        phone4?: string;
      };
      const validation = validateLookupParams(code, phone4);
      if (validation) {
        return validation(reply);
      }

      // After validation, code and phone4 are guaranteed to exist
      // biome-ignore lint/style/noNonNullAssertion: validated by validateLookupParams above
      const codeStr = code!;
      // biome-ignore lint/style/noNonNullAssertion: validated by validateLookupParams above
      const phone4Str = phone4!;

      const lockout = codeLockouts.get(codeStr);
      if (lockout && lockout.lockedUntil > Date.now()) {
        return sendNotFound(reply);
      }
      if (lockout?.lockedUntil && lockout.lockedUntil <= Date.now()) {
        codeLockouts.delete(codeStr);
      }

      const result = await lookupByCode(app.prisma, codeStr, phone4Str);
      if (!result.jobExists) {
        return sendNotFound(reply);
      }
      if (!result.job) {
        trackFailedAttempt(codeLockouts, codeStr);
        return sendNotFound(reply);
      }

      codeLockouts.delete(codeStr);
      return reply.send(result.job);
    },
  });

  app.get(
    "/by-code/:jobCode",
    { preHandler: [requirePermission({ jobs: ["view"] })] },
    async (req, reply) => {
      const { jobCode } = req.params as { jobCode: string };
      const job = await lookupByCodeAuth(app.prisma, jobCode);
      if (!job) {
        return sendError(reply, 404, "JOB_NOT_FOUND", "Job not found");
      }
      return reply.send(job);
    }
  );

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
          errors: resolveZodErrors(
            parsed.error.flatten().fieldErrors,
            req.locale
          ),
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
    const marginResult = await req.server.auth.api.userHasPermission({
      body: {
        role: (req.user?.role ?? "") as RoleType,
        permissions: { reports: ["viewMargin"] },
      },
    });
    if (marginResult.success) {
      const margin = computeMargin(job);
      return reply.send({ ...job, margin });
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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
      }
      const userId = getUserId(req);
      let result: Awaited<ReturnType<typeof createJob>>;
      try {
        result = await createJob(app.prisma, parsed.data, userId);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "DUPLICATE_REPAIR") {
          return sendError(
            reply,
            409,
            "DUPLICATE_REPAIR",
            "Duplicate repair in request"
          );
        }
        throw err;
      }
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
      if ("error" in result && result.error === "DUPLICATE_REPAIR") {
        return sendError(
          reply,
          409,
          "DUPLICATE_REPAIR",
          "Duplicate repair in request"
        );
      }

      if (result.isWarrantyReturn && "jobCode" in result) {
        app.wsBroadcast?.((c) => c.role === "OWNER", {
          type: "WARRANTY_RETURN_CREATED",
          job: {
            id: result.id,
            jobCode: (result as Record<string, unknown>).jobCode as string,
          },
        });
      }

      emitDashboardChanged(app, jobDashboardTargets(result));

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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
          }
        );
      }
      const userId = getUserId(req);
      const prev = await app.prisma.job.findUnique({
        where: { id },
        select: { technicianId: true },
      });
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
      const targets: DashboardTarget[] = ["OWNER", "FRONT_DESK"];
      if (prev?.technicianId) {
        targets.push({ technicianId: prev.technicianId });
      }
      if (result.technicianId && result.technicianId !== prev?.technicianId) {
        targets.push({ technicianId: result.technicianId });
      }
      emitDashboardChanged(app, targets);
      return reply.send(result);
    }
  );

  app.patch("/:id/status", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = transitionStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Invalid request body", {
        errors: resolveZodErrors(
          parsed.error.flatten().fieldErrors,
          req.locale
        ),
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
    if (!("error" in result)) {
      emitDashboardChanged(app, jobDashboardTargets(result));
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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
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
      if ("error" in result && result.error === "DUPLICATE_REPAIR") {
        return sendError(
          reply,
          409,
          "DUPLICATE_REPAIR",
          "This repair has already been added to the job"
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
            errors: resolveZodErrors(
              parsed.error.flatten().fieldErrors,
              req.locale
            ),
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
