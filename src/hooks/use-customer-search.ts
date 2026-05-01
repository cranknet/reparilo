import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";

export interface CustomerSearchResult {
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

export function useCustomerSearch(debounceMs = 250) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSearching(true);
    try {
      const res = await api.get("/customers/search", {
        params: { q, limit: 8 },
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      setResults(res.data as CustomerSearchResult[]);
      setSearchError(false);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setResults([]);
      setSearchError(true);
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
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
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setQuery("");
    setResults([]);
    setSearchError(false);
  }, []);

  return { clear, isSearching, query, results, searchError, setQuery };
}
