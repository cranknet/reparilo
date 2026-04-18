import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";

interface HistoryEntry {
  action: string;
  createdAt: string;
  fromValue: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  note: string | null;
  toValue: string | null;
  user: { id: string; name: string; role: string } | null;
}

export function useJobHistory(jobId: string) {
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/jobs/${jobId}/history`);
      setData(res.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch history";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
