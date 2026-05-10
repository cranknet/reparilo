import { INACTIVE_STATUSES } from "@shared/constants/job-statuses";
import { Role } from "@shared/constants/roles";
import type { FastifyInstance } from "fastify";
import { notify } from "../services/notification-dispatch.js";

const INTERVAL_MS = 15 * 60 * 1000;
const RE_ALERT_MS = 24 * 60 * 60 * 1000;

async function processOverdueJobs(app: FastifyInstance): Promise<void> {
  const cutoff = new Date(Date.now() - RE_ALERT_MS);
  const overdue = await app.prisma.job.findMany({
    select: { id: true, jobCode: true },
    where: {
      estimatedDate: { lt: new Date() },
      status: { notIn: INACTIVE_STATUSES },
      OR: [
        { lastOverdueAlertAt: null },
        { lastOverdueAlertAt: { lt: cutoff } },
      ],
    },
  });

  for (const job of overdue) {
    await notify(app, {
      context: { jobCode: job.jobCode },
      eventName: "job_overdue",
      jobId: job.id,
      recipients: { role: Role.OWNER },
    }).catch(() => {
      return;
    });
    await app.prisma.job.update({
      data: { lastOverdueAlertAt: new Date() },
      where: { id: job.id },
    });
  }
}

export function startOverdueScheduler(app: FastifyInstance): () => void {
  const tick = async (): Promise<void> => {
    try {
      await processOverdueJobs(app);
    } catch (err) {
      app.log.error(err, "overdue scheduler tick failed");
    }
  };

  const handle = setInterval(tick, INTERVAL_MS);
  tick().catch((err) =>
    app.log.error(err, "overdue scheduler initial tick failed")
  );

  return () => {
    clearInterval(handle);
  };
}
