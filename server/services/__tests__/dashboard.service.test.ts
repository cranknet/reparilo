import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type JobStatus, PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { monthRange, todayRange } from "../../utils/time-range.js";
import {
  activeJobsCount,
  activeRepairsQueue,
  avgProfitMargin,
  avgRepairTimeHours,
  completedTodayCount,
  financialTrend,
  overdueJobs,
  pickupReady,
  pipelineCounts,
  priorityActionsForTech,
  priorityAlerts,
  recentActivityForTech,
  revenueThisMonth,
  todayOverview,
  todayScheduleForTech,
  warrantyReturnsOpen,
} from "../dashboard.service.js";

const dbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const adapter = new PrismaPg({
  connectionString: dbUrl,
});
const prisma = new PrismaClient({ adapter });
const TZ = "UTC";

async function truncate() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE
    audit_logs, job_parts, job_repairs, job_notes, job_parts_waiting,
    job_photos, jobs, devices, customers, users, shop_settings
    RESTART IDENTITY CASCADE`
  );
}

async function seed() {
  const owner = await prisma.user.create({
    data: { email: "o@x", role: Role.OWNER, username: "owner" },
  });
  const tech = await prisma.user.create({
    data: { email: "t@x", role: Role.TECHNICIAN, username: "tech1" },
  });
  const cust = await prisma.customer.create({
    data: { name: "C1", phone: "0550-000-001" },
  });
  const dev = await prisma.device.create({
    data: { brand: "Apple", model: "iPhone 14" },
  });
  const mk = (
    status: JobStatus,
    opts: { deliveredAt?: Date; tech?: string } = {}
  ) =>
    prisma.job.create({
      data: {
        accessCode: "x",
        customerId: cust.id,
        createdById: owner.id,
        deviceId: dev.id,
        estimatedCost: 100,
        jobCode: `J-${Math.random().toString(36).slice(2, 8)}`,
        reportedProblem: "p",
        status,
        technicianId: opts.tech ?? null,
        updatedAt: opts.deliveredAt,
      },
    });
  return { cust, dev, mk, owner, tech };
}

beforeAll(async () => {
  await truncate();
});
beforeEach(async () => {
  await truncate();
});
afterAll(async () => {
  await truncate();
  await prisma.$disconnect();
});

describe("pipelineCounts", () => {
  it("returns counts grouped by status (owner scope)", async () => {
    const { mk } = await seed();
    await mk("INTAKE");
    await mk("INTAKE");
    await mk("IN_REPAIR");
    const counts = await pipelineCounts(prisma, {
      role: "OWNER",
      shopTz: TZ,
      userId: "u",
    });
    expect(counts.INTAKE).toBe(2);
    expect(counts.IN_REPAIR).toBe(1);
    expect(counts.DELIVERED).toBe(0);
  });

  it("filters by technicianId when role is TECHNICIAN", async () => {
    const { mk, tech } = await seed();
    await mk("IN_REPAIR", { tech: tech.id });
    await mk("IN_REPAIR");
    const counts = await pipelineCounts(prisma, {
      role: "TECHNICIAN",
      shopTz: TZ,
      userId: tech.id,
    });
    expect(counts.IN_REPAIR).toBe(1);
  });
});

describe("activeJobsCount", () => {
  it("sums INTAKE+IN_REPAIR+ON_HOLD+WAITING_FOR_PARTS", async () => {
    const { mk } = await seed();
    await mk("INTAKE");
    await mk("IN_REPAIR");
    await mk("DONE");
    const n = await activeJobsCount(prisma, {
      role: "OWNER",
      shopTz: TZ,
      userId: "u",
    });
    expect(n).toBe(2);
  });
});

describe("completedTodayCount", () => {
  it("counts DELIVERED jobs whose updatedAt is in today range", async () => {
    const { mk } = await seed();
    const now = new Date();
    await mk("DELIVERED", { deliveredAt: now });
    await mk("DELIVERED", { deliveredAt: new Date("2020-01-01") });
    const n = await completedTodayCount(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      todayRange(TZ, now)
    );
    expect(n).toBe(1);
  });
});

describe("revenueThisMonth", () => {
  it("sums repairs + parts for DELIVERED jobs this month only", async () => {
    const { cust, dev, owner } = await seed();
    const now = new Date();
    const job = await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "J-REV",
        reportedProblem: "p",
        status: "DELIVERED",
        updatedAt: now,
      },
    });
    await prisma.jobRepair.create({
      data: {
        category: "HARDWARE",
        createdById: owner.id,
        jobId: job.id,
        price: 100,
        repairName: "screen",
      },
    });
    await prisma.jobPart.create({
      data: {
        category: "SCREEN",
        createdById: owner.id,
        jobId: job.id,
        partName: "LCD",
        quantity: 1,
        totalCost: 60,
        unitPrice: 60,
      },
    });
    const r = await revenueThisMonth(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      monthRange(TZ, now)
    );
    expect(r).toBe(160);
  });

  it("returns 0 when no delivered jobs in range", async () => {
    await seed();
    const r = await revenueThisMonth(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      monthRange(TZ, new Date())
    );
    expect(r).toBe(0);
  });
});

describe("avgProfitMargin", () => {
  it("returns (revenue-cost)/revenue rounded to 2 decimals", async () => {
    const { cust, dev, owner } = await seed();
    const now = new Date();
    const job = await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "J-PM",
        reportedProblem: "p",
        status: "DELIVERED",
        updatedAt: now,
      },
    });
    await prisma.jobRepair.create({
      data: {
        category: "HARDWARE",
        createdById: owner.id,
        jobId: job.id,
        price: 100,
        repairName: "r",
      },
    });
    await prisma.jobPart.create({
      data: {
        category: "SCREEN",
        createdById: owner.id,
        jobId: job.id,
        partName: "p",
        quantity: 1,
        totalCost: 40,
        unitPrice: 40,
      },
    });
    const m = await avgProfitMargin(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      monthRange(TZ, now)
    );
    expect(m).toBe(0.71);
  });

  it("returns 0 when revenue is 0", async () => {
    await seed();
    const m = await avgProfitMargin(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      monthRange(TZ, new Date())
    );
    expect(m).toBe(0);
  });
});

describe("financialTrend", () => {
  it("returns 7 points, zero-filled, oldest first", async () => {
    const { cust, dev, owner } = await seed();
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const job = await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "J-FT",
        reportedProblem: "p",
        status: "DELIVERED",
        updatedAt: today,
      },
    });
    await prisma.jobRepair.create({
      data: {
        category: "HARDWARE",
        createdById: owner.id,
        jobId: job.id,
        price: 50,
        repairName: "r",
      },
    });
    const pts = await financialTrend(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      7
    );
    expect(pts).toHaveLength(7);
    expect(pts.at(-1)?.revenue).toBe(50);
    expect(pts[0].revenue).toBe(0);
  });
});

describe("overdueJobs", () => {
  it("returns active jobs with estimatedDate < today, capped", async () => {
    const { cust, dev, owner } = await seed();
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        estimatedDate: new Date("2020-01-01"),
        jobCode: "J-OD1",
        reportedProblem: "p",
        status: "IN_REPAIR",
      },
    });
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        estimatedDate: new Date("2020-01-01"),
        jobCode: "J-OD2",
        reportedProblem: "p",
        status: "DELIVERED",
      },
    });
    const r = await overdueJobs(
      prisma,
      { role: "OWNER", shopTz: TZ, userId: "u" },
      10
    );
    expect(r.map((j) => j.jobCode)).toEqual(["J-OD1"]);
    expect(r[0].hoursLate).toBeGreaterThan(0);
  });
});

describe("warrantyReturnsOpen", () => {
  it("returns isWarrantyReturn jobs not in {DELIVERED, CANCELLED}", async () => {
    const { cust, dev, owner } = await seed();
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        isWarrantyReturn: true,
        jobCode: "J-WR-OPEN",
        reportedProblem: "phantom touch",
        status: "IN_REPAIR",
      },
    });
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        isWarrantyReturn: true,
        jobCode: "J-WR-CLOSED",
        reportedProblem: "x",
        status: "DELIVERED",
      },
    });
    const r = await warrantyReturnsOpen(prisma, 5);
    expect(r).toHaveLength(1);
    expect(r[0].jobCode).toBe("J-WR-OPEN");
    expect(r[0].description).toBe("phantom touch");
  });
});

describe("todayScheduleForTech", () => {
  it("returns jobs with estimatedDate = today (UTC); falls back to top 5 active", async () => {
    const { cust, dev, owner, tech } = await seed();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        estimatedDate: today,
        jobCode: "J-SCHED",
        reportedProblem: "p",
        status: "IN_REPAIR",
        technicianId: tech.id,
      },
    });
    const s = await todayScheduleForTech(prisma, tech.id, {
      end: new Date(today.getTime() + 86_400_000),
      start: today,
    });
    expect(s).toHaveLength(1);
    expect(s[0].jobCode).toBe("J-SCHED");
  });
});

describe("recentActivityForTech", () => {
  it("returns audit logs by self OR on jobs assigned to self, newest first, capped", async () => {
    const { mk, owner, tech } = await seed();
    const job = await mk("IN_REPAIR", { tech: tech.id });
    await prisma.auditLog.create({
      data: {
        action: "STATUS_CHANGED",
        fromValue: "INTAKE",
        jobId: job.id,
        toValue: "IN_REPAIR",
        userId: tech.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "JOB_UPDATED",
        jobId: job.id,
        userId: owner.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "USER_SIGN_IN",
        userId: owner.id,
      },
    });
    const acts = await recentActivityForTech(prisma, tech.id, 20);
    expect(acts).toHaveLength(2);
    expect(acts[0].jobCode).toBe(job.jobCode);
  });
});

describe("avgRepairTimeHours", () => {
  it("returns 0 when no deliveries in window", async () => {
    const { tech } = await seed();
    expect(await avgRepairTimeHours(prisma, tech.id, 30)).toBe(0);
  });
});

describe("priorityActionsForTech", () => {
  it("counts stale IN_REPAIR, overdue, and WAITING_FOR_PARTS", async () => {
    const { cust, dev, owner, tech } = await seed();
    const long = new Date(Date.now() - 48 * 3_600_000);
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "J-STALE",
        reportedProblem: "p",
        status: "IN_REPAIR",
        technicianId: tech.id,
        updatedAt: long,
      },
    });
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "J-WFP",
        reportedProblem: "p",
        status: "WAITING_FOR_PARTS",
        technicianId: tech.id,
      },
    });
    const p = await priorityActionsForTech(prisma, tech.id);
    expect(p.jobsNeedingStatusUpdate).toBe(1);
    expect(p.partsWaitingCount).toBe(1);
  });
});

describe("activeRepairsQueue", () => {
  it("returns active + delivered-today jobs, capped, newest first", async () => {
    const { mk } = await seed();
    await mk("INTAKE");
    await mk("DELIVERED", { deliveredAt: new Date() });
    await mk("CANCELLED");
    const r = await activeRepairsQueue(
      prisma,
      {
        end: new Date(Date.now() + 86_400_000),
        start: new Date(Date.now() - 86_400_000),
      },
      20
    );
    expect(r).toHaveLength(2);
  });
});

describe("todayOverview", () => {
  it("counts jobs created today and delivered today", async () => {
    const { cust, dev, owner } = await seed();
    const now = new Date();
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        createdAt: now,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "T1",
        reportedProblem: "p",
        status: "INTAKE",
      },
    });
    await prisma.job.create({
      data: {
        accessCode: "x",
        createdById: owner.id,
        createdAt: now,
        customerId: cust.id,
        deviceId: dev.id,
        estimatedCost: 0,
        jobCode: "T2",
        reportedProblem: "p",
        status: "DELIVERED",
        updatedAt: now,
      },
    });
    const o = await todayOverview(prisma, {
      end: new Date(now.getTime() + 3_600_000),
      start: new Date(now.getTime() - 3_600_000),
    });
    expect(o.totalToday).toBe(2);
    expect(o.completedToday).toBe(1);
    expect(o.recentIntakes).toHaveLength(1);
  });
});

describe("pickupReady", () => {
  it("returns DONE jobs with customer + device details", async () => {
    const { mk } = await seed();
    await mk("DONE");
    const r = await pickupReady(prisma, 10);
    expect(r).toHaveLength(1);
    expect(r[0].customerName).toBeTruthy();
  });
});

describe("priorityAlerts", () => {
  it("returns a bounded list across kinds", async () => {
    const { mk } = await seed();
    await mk("DONE");
    const r = await priorityAlerts(prisma, 5);
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(5);
    expect(
      r.every((a) =>
        ["OVERDUE", "WARRANTY_RETURN", "READY_FOR_PICKUP"].includes(a.kind)
      )
    ).toBe(true);
  });
});
