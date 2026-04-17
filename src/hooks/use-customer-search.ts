import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";

interface CustomerSearchResult {
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

export function useCustomerSearch(debounceMs = 250) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get("/customers/search", {
        params: { q, limit: 8 },
      });
      setResults(res.data as CustomerSearchResult[]);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      search(query);
    }, debounceMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs, search]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  return { clear, isSearching, query, results, setQuery };
}
