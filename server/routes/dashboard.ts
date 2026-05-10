import type { FastifyPluginAsync } from "fastify";
import { dashboardScope } from "../middlewares/dashboard-scope.js";
import { requirePermission } from "../middlewares/rbac.js";
import {
  activeJobsCount,
  activeRepairsQueue,
  avgProfitMargin,
  avgRepairTimeHours,
  avgRepairTimeHoursShop,
  completedTodayCount,
  financialTrend,
  overdueJobs,
  partsAlertsForTech,
  pickupReady,
  pipelineCounts,
  priorityActionsForTech,
  priorityAlerts,
  recentActivityForTech,
  revenueThisMonth,
  todayOverview,
  todayScheduleForTech,
  waitingForPartsCount,
  warrantyReturnsOpen,
} from "../services/dashboard.service.js";
import { monthRange, todayRange } from "../utils/time-range.js";

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/owner",
    {
      preHandler: [
        requirePermission({ dashboard: ["viewOwner"] }),
        dashboardScope,
      ],
      schema: { tags: ["dashboard"], summary: "Owner dashboard" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const now = new Date();
      const today = todayRange(scope.shopTz, now);
      const month = monthRange(scope.shopTz, now);
      const [
        pipeline,
        activeJobs,
        completedToday,
        revenue,
        margin,
        trend,
        overdue,
        warranty,
      ] = await Promise.all([
        pipelineCounts(app.prisma, scope),
        activeJobsCount(app.prisma, scope),
        completedTodayCount(app.prisma, scope, today),
        revenueThisMonth(app.prisma, scope, month),
        avgProfitMargin(app.prisma, scope, month),
        financialTrend(app.prisma, scope, 7),
        overdueJobs(app.prisma, scope, 10),
        warrantyReturnsOpen(app.prisma, scope, 5),
      ]);
      return {
        pipeline,
        activeJobs,
        completedToday,
        revenueThisMonth: revenue,
        avgProfitMargin: margin,
        financialTrend: trend,
        overdueJobs: overdue,
        warrantyReturns: warranty,
      };
    }
  );

  app.get(
    "/technician",
    {
      preHandler: [
        requirePermission({ dashboard: ["viewTechnician"] }),
        dashboardScope,
      ],
      schema: { tags: ["dashboard"], summary: "Technician dashboard" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const techScope = { ...scope, role: "TECHNICIAN" as const };
      const now = new Date();
      const today = todayRange(scope.shopTz, now);
      const [
        pipeline,
        waitingForParts,
        completedToday,
        todaySchedule,
        recentActivity,
        repairTime,
        priorityActions,
        partsAlerts,
      ] = await Promise.all([
        pipelineCounts(app.prisma, techScope),
        waitingForPartsCount(app.prisma, scope.userId),
        completedTodayCount(app.prisma, techScope, today),
        todayScheduleForTech(app.prisma, scope.userId, today),
        recentActivityForTech(app.prisma, scope.userId, 20),
        avgRepairTimeHours(app.prisma, scope.userId, 30),
        priorityActionsForTech(app.prisma, scope.userId),
        partsAlertsForTech(app.prisma, 10),
      ]);
      const myActiveJobs =
        pipeline.INTAKE +
        pipeline.IN_REPAIR +
        pipeline.ON_HOLD +
        pipeline.WAITING_FOR_PARTS;
      return {
        pipeline,
        myActiveJobs,
        completedToday,
        waitingForParts,
        avgRepairTimeHours: repairTime,
        todaySchedule,
        recentActivity,
        priorityActions,
        partsAlerts,
      };
    }
  );

  app.get(
    "/front-desk",
    {
      preHandler: [
        requirePermission({ dashboard: ["viewFrontDesk"] }),
        dashboardScope,
      ],
      schema: { tags: ["dashboard"], summary: "Front desk dashboard" },
    },
    async (req) => {
      // biome-ignore lint/style/noNonNullAssertion: set by dashboardScope preHandler
      const scope = req.dashboardScope!;
      const now = new Date();
      const today = todayRange(scope.shopTz, now);
      const [activeRepairs, overview, alerts, ready, repairTime] =
        await Promise.all([
          activeRepairsQueue(app.prisma, scope, today, 20),
          todayOverview(app.prisma, scope, today),
          priorityAlerts(app.prisma, scope, 5),
          pickupReady(app.prisma, scope, 10),
          avgRepairTimeHoursShop(app.prisma, scope, 30),
        ]);
      return {
        activeRepairs,
        avgRepairTimeHours: repairTime,
        todayOverview: overview,
        priorityAlerts: alerts,
        pickupReady: ready,
      };
    }
  );
};
