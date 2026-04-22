import { INACTIVE_STATUSES } from "@shared/constants";
import type { FastifyInstance } from "fastify";

const alerted = new Set<string>();
const MAX_ALERTED = 10_000;
const INTERVAL_MS = 15 * 60 * 1000;

async function processOverdueJobs(app: FastifyInstance): Promise<void> {
  const overdue = await app.prisma.job.findMany({
    select: { id: true, jobCode: true },
    where: {
      estimatedDate: { lt: new Date() },
      status: { notIn: INACTIVE_STATUSES },
    },
  });

  const overdueIds = new Set(overdue.map((j) => j.id));

  for (const id of alerted) {
    if (!overdueIds.has(id)) {
      alerted.delete(id);
    }
  }

  if (alerted.size > MAX_ALERTED) {
    const iter = alerted.values();
    const toRemove = alerted.size - MAX_ALERTED;
    for (let i = 0; i < toRemove; i++) {
      const { value, done } = iter.next();
      if (!done && value !== undefined) {
        alerted.delete(value);
      }
    }
  }

  for (const job of overdue) {
    if (alerted.has(job.id)) {
      continue;
    }
    alerted.add(job.id);
    app.wsBroadcast?.((c) => c.role === "OWNER", {
      type: "JOB_OVERDUE",
      job: { id: job.id, jobCode: job.jobCode },
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
    alerted.clear();
  };
}
