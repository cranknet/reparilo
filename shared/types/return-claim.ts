export type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaim,
  ReturnClaimStatus,
} from "@prisma/client";

export interface ReturnClaimSummary {
  ageDays: number;
  claimedPartName: string | null;
  claimedRepairName: string | null;
  customerName: string;
  faultCategory: FaultCategory | null;
  id: string;
  isGoodwill: boolean;
  openedAt: Date;
  originalJobCode: string;
  originalJobId: string;
  resolutionOutcome: ResolutionOutcome | null;
  resolvedAt: Date | null;
  returnReason: string;
  status: ReturnClaimStatus;
}

export interface CreateReturnClaimInput {
  claimedJobPartId?: string;
  claimedJobRepairId?: string;
  originalJobId: string;
  returnReason: string;
}

export interface TriageInput {
  faultCategory: FaultCategory;
}

export interface ResolveInput {
  partialChargeAmount?: number;
  refundAmount?: number;
  resolutionOutcome: ResolutionOutcome;
}

export interface ListReturnClaimsQuery {
  faultCategory?: FaultCategory;
  from?: string;
  limit?: number;
  originalJobId?: string;
  page?: number;
  resolutionOutcome?: ResolutionOutcome;
  status?: ReturnClaimStatus;
  technicianId?: string;
  to?: string;
}
