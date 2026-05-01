export type TimeRangePreset = "7d" | "30d" | "month" | "year";

export interface RevenueSummary {
  avgProfitMargin?: number;
  outstandingBalance: number;
  outstandingJobCount: number;
  revenueChangePercent?: number;
  totalDeposits: number;
  totalRevenue: number;
}

export interface RevenueBreakdownRow {
  completedAt: string;
  customerName: string;
  depositAmount: number;
  deviceName: string;
  estimatedCost: number;
  jobCode: string;
  margin?: number;
  partsCost: number;
  repairsTotal: number;
}

export interface RevenueReportDTO {
  breakdown: RevenueBreakdownRow[];
  summary: RevenueSummary;
}

export interface OperationsSummary {
  avgTurnaroundHours: number;
  jobsCompleted: number;
  jobsCompletedChangePercent?: number;
  jobsInProgress: number;
  warrantyReturnRate?: number;
}

export interface TopRepairRow {
  avgPrice: number;
  category: string;
  count: number;
  repairName: string;
  revenue: number;
}

export interface StatusBreakdownRow {
  avgDays: number;
  count: number;
  status: string;
}

export interface OperationsReportDTO {
  statusBreakdown: StatusBreakdownRow[];
  summary: OperationsSummary;
  topRepairs: TopRepairRow[];
}

export interface InsightsSummary {
  avgSpendPerVisit: number;
  newCustomers: number;
  repeatRate: number;
  returningCustomers: number;
  totalCustomers: number;
  totalJobs: number;
}

export interface TopCustomerRow {
  avgSpend: number;
  customerId: string;
  customerName: string;
  lastVisit: string;
  phone: string;
  totalJobs: number;
  totalRevenue: number;
}

export interface InsightsReportDTO {
  summary: InsightsSummary;
  topCustomers: TopCustomerRow[];
}
