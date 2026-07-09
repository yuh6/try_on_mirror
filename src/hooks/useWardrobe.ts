"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type {
  CreateWardrobeItemRequest,
  WardrobeCategory,
  WardrobeItem,
} from "@/lib/api-types";

type UseWardrobeState = {
  items: WardrobeItem[];
  categories: WardrobeCategory[];
  loading: boolean;
  error: string | null;
};

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "未知错误";
};

/**
 * Loads wardrobe items, optionally filtered by category.
 * Aborts in-flight requests on unmount / category change.
 */
export function useWardrobe(category?: string) {
  const [state, setState] = useState<UseWardrobeState>({
    items: [],
    categories: [],
    loading: true,
    error: null,
  });

  const controllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any previous request.
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.listWardrobe(category, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setState({
        items: data.items,
        categories: data.categories,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (isAbort(err) || ctrl.signal.aborted) return;
      setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
    }
  }, [category]);

  useEffect(() => {
    fetchData();
    return () => {
      controllerRef.current?.abort();
    };
  }, [fetchData]);

  const addItem = useCallback(async (payload: CreateWardrobeItemRequest) => {
    const res = await api.createWardrobeItem(payload);
    setState((s) => ({ ...s, items: [...s.items, res.item] }));
    return res.item;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await api.deleteWardrobeItem(id);
    setState((s) => ({ ...s, items: s.items.filter((it) => it.id !== id) }));
  }, []);

  return {
    items: state.items,
    categories: state.categories,
    loading: state.loading,
    error: state.error,
    refetch: fetchData,
    addItem,
    removeItem,
  };
}
