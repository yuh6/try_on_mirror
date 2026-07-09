"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type { GenerateRequest, GenerateResponse } from "@/lib/api-types";

type UseGenerateState = {
  loading: boolean;
  error: string | null;
  result: GenerateResponse | null;
};

/**
 * Triggers the /api/generate flow.
 * Uses an internal AbortController — 120 s frontend timeout matches DESIGN §3.4.
 */
export function useGenerate() {
  const [state, setState] = useState<UseGenerateState>({
    loading: false,
    error: null,
    result: null,
  });

  const controllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const generate = useCallback(async (payload: GenerateRequest) => {
    // Cancel any prior in-flight generation.
    controllerRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const ctrl = new AbortController();
    controllerRef.current = ctrl;
    timeoutRef.current = setTimeout(() => ctrl.abort(), 120_000);

    setState({ loading: true, error: null, result: null });
    try {
      const data = await api.generate(payload, { signal: ctrl.signal });
      if (!mountedRef.current || ctrl.signal.aborted) return null;
      setState({ loading: false, error: null, result: data });
      return data;
    } catch (err) {
      if (!mountedRef.current) return null;
      if (err instanceof DOMException && err.name === "AbortError") {
        setState({ loading: false, error: "请求超时，请重试", result: null });
        return null;
      }
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "生成失败，请重试";
      setState({ loading: false, error: msg, result: null });
      return null;
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setState({ loading: false, error: null, result: null });
  }, []);

  return {
    generate,
    loading: state.loading,
    error: state.error,
    result: state.result,
    reset,
  };
}
