"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import type { AnalyzeResponse } from "@/lib/api-types";

// SKILL §四 四阶段:
//  - locating: 定位轮廓（0.8s 目标）
//  - analyzing: 解析气质（1.5-3s，跟随上游）
//  - modeling: 匹配方案（0.8-1.5s）
//  - reveal: 揭幕（呈现文案）
// 若上游更快返回,阶段能"跳节拍"提前推进,避免假动画硬凑时间。

export type AnalysisPhase =
  | "idle"
  | "locating"
  | "analyzing"
  | "modeling"
  | "reveal";

const PHASE_MIN_MS: Record<Exclude<AnalysisPhase, "idle" | "reveal">, number> = {
  locating: 800,
  analyzing: 1500,
  modeling: 800,
};

type State = {
  phase: AnalysisPhase;
  result: AnalyzeResponse | null;
  error: string | null;
};

const INITIAL: State = { phase: "idle", result: null, error: null };

/**
 * 触发形象分析并驱动四阶段视觉推进。
 * 每次 analyze() 会取消前一次未完成的请求与计时器。
 */
export function useAnalysis() {
  const [state, setState] = useState<State>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const clearTimers = () => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      clearTimers();
    };
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearTimers();
    setState(INITIAL);
  }, []);

  const analyze = useCallback(async (personImage: string) => {
    // 取消前一轮
    controllerRef.current?.abort();
    clearTimers();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    const t0 = Date.now();
    setState({ phase: "locating", result: null, error: null });

    // 定时推进阶段(只做视觉引导,真正的收束由 result 到达触发)
    const push = (delay: number, phase: AnalysisPhase) => {
      const id = window.setTimeout(() => {
        if (ctrl.signal.aborted || !mountedRef.current) return;
        setState((s) => {
          // 已经到 reveal 就别倒推
          if (s.phase === "reveal") return s;
          return { ...s, phase };
        });
      }, delay);
      timersRef.current.push(id);
    };
    push(PHASE_MIN_MS.locating, "analyzing");
    push(PHASE_MIN_MS.locating + PHASE_MIN_MS.analyzing, "modeling");

    let result: AnalyzeResponse | null = null;
    let error: string | null = null;
    try {
      result = await api.analyzeAppearance({ personImage }, { signal: ctrl.signal });
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === "AbortError") ||
        ctrl.signal.aborted
      ) {
        return; // 静默:被下一次 analyze/reset 顶掉
      }
      error = err instanceof Error ? err.message : "分析失败";
    }

    if (ctrl.signal.aborted || !mountedRef.current) return;

    // 保证至少走完 locating 阶段的最短时间,避免"瞬闪"
    const elapsed = Date.now() - t0;
    const minTotal = PHASE_MIN_MS.locating + 200; // 800 + 200 缓冲
    const wait = Math.max(0, minTotal - elapsed);

    const finish = window.setTimeout(() => {
      if (ctrl.signal.aborted || !mountedRef.current) return;
      clearTimers();
      setState({ phase: "reveal", result, error });
    }, wait);
    timersRef.current.push(finish);
  }, []);

  return {
    phase: state.phase,
    result: state.result,
    error: state.error,
    /** 便于外部条件渲染 */
    analyzing:
      state.phase === "locating" ||
      state.phase === "analyzing" ||
      state.phase === "modeling",
    done: state.phase === "reveal",
    analyze,
    reset,
  };
}
