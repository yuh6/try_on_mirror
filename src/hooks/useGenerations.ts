"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type { Generation, GenerationStatus } from "@/lib/api-types";

const PAGE_SIZE = 20;

type UseGenerationsState = {
  items: Generation[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  initialLoaded: boolean;
};

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException && err.name === "AbortError";

const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "加载历史失败";
};

/**
 * Cursor-paginated wrapper around GET /api/generations.
 * `loadMore` fetches the next page using the last known cursor.
 * `remove` optimistically drops the row and calls DELETE.
 */
export function useGenerations(opts: { status?: GenerationStatus } = {}) {
  const { status } = opts;
  const [state, setState] = useState<UseGenerationsState>({
    items: [],
    nextCursor: null,
    loading: true,
    error: null,
    initialLoaded: false,
  });

  const controllerRef = useRef<AbortController | null>(null);
  const inflightRef = useRef(false);

  const loadPage = useCallback(
    async (cursor: string | null, replace: boolean) => {
      if (inflightRef.current) return;
      inflightRef.current = true;

      controllerRef.current?.abort();
      const ctrl = new AbortController();
      controllerRef.current = ctrl;

      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await api.listGenerations(
          {
            limit: PAGE_SIZE,
            cursor: cursor ?? undefined,
            status,
          },
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        setState((s) => ({
          items: replace ? data.items : [...s.items, ...data.items],
          nextCursor: data.nextCursor,
          loading: false,
          error: null,
          initialLoaded: true,
        }));
      } catch (err) {
        if (isAbort(err) || ctrl.signal.aborted) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: errorMessage(err),
          initialLoaded: true,
        }));
      } finally {
        inflightRef.current = false;
      }
    },
    [status],
  );

  useEffect(() => {
    // Initial load / reload on status change.
    setState({
      items: [],
      nextCursor: null,
      loading: true,
      error: null,
      initialLoaded: false,
    });
    loadPage(null, true);
    return () => {
      controllerRef.current?.abort();
    };
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!state.nextCursor || state.loading) return;
    loadPage(state.nextCursor, false);
  }, [state.nextCursor, state.loading, loadPage]);

  const refetch = useCallback(() => {
    loadPage(null, true);
  }, [loadPage]);

  const remove = useCallback(async (id: string) => {
    // Optimistic: snapshot for rollback.
    let snapshot: Generation[] = [];
    setState((s) => {
      snapshot = s.items;
      return { ...s, items: s.items.filter((it) => it.id !== id) };
    });
    try {
      await api.deleteGeneration(id);
    } catch (err) {
      // Rollback and surface the error.
      setState((s) => ({
        ...s,
        items: snapshot,
        error: errorMessage(err),
      }));
      throw err;
    }
  }, []);

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    hasMore: state.nextCursor !== null,
    initialLoaded: state.initialLoaded,
    loadMore,
    refetch,
    remove,
  };
}
