import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type {
  FaultCategory,
  ListClaimsParams,
  ListClaimsResponse,
  PhotoStage,
  ResolutionOutcome,
  ReturnClaimDetail,
} from "@/types/return-claim";

const KEY = "return-claims";

export function useReturnClaimsList(params: ListClaimsParams) {
  return useQuery({
    queryKey: [KEY, "list", params],
    queryFn: async () => {
      const res = await api.get<ListClaimsResponse>("/return-claims", {
        params,
      });
      return res.data;
    },
  });
}

export function useReturnClaim(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, "detail", id],
    queryFn: async () => {
      const res = await api.get<ReturnClaimDetail>(`/return-claims/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateReturnClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      originalJobId: string;
      claimedJobRepairId?: string;
      claimedJobPartId?: string;
      returnReason: string;
    }) => {
      const res = await api.post<{ id: string }>("/return-claims", input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useTriageClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { faultCategory: FaultCategory }) => {
      const res = await api.patch(`/return-claims/${id}/triage`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}

export function useSpawnRework(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ claimId: string; reworkJobId: string }>(
        `/return-claims/${id}/spawn-rework`
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useResolveClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resolutionOutcome: ResolutionOutcome;
      partialChargeAmount?: number;
      refundAmount?: number;
    }) => {
      const res = await api.patch(`/return-claims/${id}/resolve`, input);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useUploadClaimPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; stage: PhotoStage }) => {
      const fd = new FormData();
      fd.append("file", input.file);
      fd.append("stage", input.stage);
      const res = await api.post(`/return-claims/${id}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}

export function useDeleteClaimPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/return-claims/${id}/photos/${photoId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, "detail", id] });
    },
  });
}
