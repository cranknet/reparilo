import api from "@/lib/api";
import type {
  ListClaimsParams,
  ListClaimsResponse,
  PhotoStage,
  ReturnClaimDetail,
} from "@/types/return-claim";

export async function fetchReturnClaims(
  params: ListClaimsParams
): Promise<ListClaimsResponse> {
  const res = await api.get<ListClaimsResponse>("/return-claims", { params });
  return res.data;
}

export async function fetchReturnClaim(id: string): Promise<ReturnClaimDetail> {
  const res = await api.get<ReturnClaimDetail>(`/return-claims/${id}`);
  return res.data;
}

export async function createReturnClaim(input: {
  originalJobId: string;
  claimedJobRepairId?: string;
  claimedJobPartId?: string;
  returnReason: string;
}): Promise<{ id: string }> {
  const res = await api.post<{ id: string }>("/return-claims", input);
  return res.data;
}

export async function triageClaim(
  id: string,
  input: { faultCategory: string }
): Promise<unknown> {
  const res = await api.patch(`/return-claims/${id}/triage`, input);
  return res.data;
}

export async function spawnRework(
  id: string
): Promise<{ claimId: string; reworkJobId: string }> {
  const res = await api.post<{ claimId: string; reworkJobId: string }>(
    `/return-claims/${id}/spawn-rework`
  );
  return res.data;
}

export async function resolveClaim(
  id: string,
  input: {
    resolutionOutcome: string;
    partialChargeAmount?: number;
    refundAmount?: number;
  }
): Promise<unknown> {
  const res = await api.patch(`/return-claims/${id}/resolve`, input);
  return res.data;
}

export async function uploadClaimPhoto(
  id: string,
  input: { file: File; stage: PhotoStage }
): Promise<unknown> {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("stage", input.stage);
  const res = await api.post(`/return-claims/${id}/photos`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteClaimPhoto(
  id: string,
  photoId: string
): Promise<void> {
  await api.delete(`/return-claims/${id}/photos/${photoId}`);
}
