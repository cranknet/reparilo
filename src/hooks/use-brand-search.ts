import { useCallback, useEffect, useRef, useState } from "react";
import api, { type ApiError } from "@/lib/api";

export interface BrandSearchResult {
  id: string;
  name: string;
}

export function useBrandSearch(debounceMs = 250) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BrandSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSearching(true);
    try {
      const res = await api.get("/brands/search", {
        params: { q, limit: 20 },
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      setResults(res.data.brands as BrandSearchResult[]);
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
    setCreateError(null);
  }, []);

  const createBrand = useCallback(
    async (name: string): Promise<BrandSearchResult | null> => {
      setIsCreating(true);
      setCreateError(null);
      try {
        const res = await api.post("/brands", { name });
        const brand = res.data as BrandSearchResult;
        setResults((prev) => [...prev, brand]);
        return brand;
      } catch (err: unknown) {
        const apiErr = err as Partial<ApiError>;
        setCreateError(apiErr?.message ?? "Failed to add brand");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return {
    clear,
    createBrand,
    createError,
    isCreating,
    isSearching,
    query,
    results,
    search,
    searchError,
    setQuery,
  };
}
