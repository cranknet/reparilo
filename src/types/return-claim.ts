import type {
  FaultCategory,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaimStatus,
} from "@generated/enums";

export interface ClaimWarrantyInfo {
  claimedLineWarrantyDays: number;
  deliveredAt: string | null;
  isInWarrantyAtOpen: boolean;
}

export interface ReturnClaimDetail {
  claimedJobPart: {
    category: string;
    id: string;
    partName: string;
    totalCost: number;
  } | null;
  claimedJobRepair: {
    category: string;
    id: string;
    price: number;
    repairName: string;
  } | null;
  faultCategory: FaultCategory | null;
  id: string;
  openedAt: string;
  openedBy: { id: string; name: string };
  originalJob: {
    customer: { id: string; name: string; phone: string };
    device: { brand: { name: string } | string; id: string; model: string };
    id: string;
    jobCode: string;
    partsUsed: Array<{
      category: string;
      id: string;
      partName: string;
      totalCost: number;
    }>;
    repairs: Array<{
      category: string;
      id: string;
      price: number;
      repair: { warrantyDays: number | null } | null;
      repairName: string;
    }>;
    status: string;
    technicianId: string | null;
  };
  partialChargeAmount: number | null;
  photos: Array<{
    createdAt: string;
    id: string;
    path: string;
    returnClaimId: string | null;
    stage: PhotoStage | null;
  }>;
  refundAmount: number | null;
  resolutionOutcome: ResolutionOutcome | null;
  resolvedAt: string | null;
  resolvedBy: { id: string; name: string } | null;
  returnReason: string;
  reworkJob: { id: string; jobCode: string; status: string } | null;
  status: ReturnClaimStatus;
  warrantyInfo: ClaimWarrantyInfo;
}

export interface ReturnClaimListItem {
  claimedJobPart: { partName: string } | null;
  claimedJobRepair: { repairName: string } | null;
  faultCategory: FaultCategory | null;
  id: string;
  openedAt: string;
  originalJob: { customer: { name: string }; id: string; jobCode: string };
  resolutionOutcome: ResolutionOutcome | null;
  resolvedAt: string | null;
  status: ReturnClaimStatus;
}

export interface ListClaimsParams {
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

export interface ListClaimsResponse {
  items: ReturnClaimListItem[];
  limit: number;
  page: number;
  total: number;
}
