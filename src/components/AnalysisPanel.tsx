"use client";

import { Sparkles, Wand2 } from "lucide-react";
import type { AnalyzeResponse } from "@/lib/api-types";
import type { AnalysisPhase } from "@/hooks/useAnalysis";

// SKILL §四 · 等待即体验
//   四阶段:定位 / 分析 / 建模 / 揭幕
//   禁 spinner + 百分比,采用扫描线 + 呼吸光晕,香槟色系,避冷蓝/赛博绿。

export type AnalysisPanelProps = {
  phase: AnalysisPhase;
  result: AnalyzeResponse | null;
  error: string | null;
  className?: string;
};

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  idle: "",
  locating: "正在捕捉您的形象…",
  analyzing: "解析气质与神韵…",
  modeling: "为您匹配专属方案…",
  reveal: "",
};

export function AnalysisPanel({
  phase,
  result,
  error,
  className,
}: AnalysisPanelProps) {
  if (phase === "idle") return null;

  const isAnalyzing =
    phase === "locating" || phase === "analyzing" || phase === "modeling";

  return (
    <section
      className={`rounded-2xl border border-[#D4C4A0] bg-[#FAF5EB]/70 backdrop-blur-sm overflow-hidden ${className ?? ""}`}
      aria-live="polite"
    >
      {isAnalyzing ? (
        <ScanningView phase={phase} />
      ) : error ? (
        <ErrorView message={error} />
      ) : result ? (
        <RevealView result={result} />
      ) : null}
    </section>
  );
}

/* ----------------- 分析中：扫描线 + 呼吸光晕 ----------------- */

function ScanningView({ phase }: { phase: AnalysisPhase }) {
  return (
    <div className="relative px-4 py-5 flex flex-col items-center gap-3">
      {/* 光晕（呼吸）+ 扫描线（自上而下） */}
      <div className="relative w-full h-16 rounded-xl overflow-hidden bg-gradient-to-b from-[#1E2D24]/[0.04] to-[#C5A880]/10">
        <span
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 100% at 50% 50%, rgba(197,168,128,0.35) 0%, transparent 60%)",
            animation: "xa-breath 2.4s ease-in-out infinite",
          }}
        />
        <span
          className="absolute left-0 right-0 h-[2px] pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(197,168,128,0.85), transparent)",
            filter: "drop-shadow(0 0 6px rgba(197,168,128,0.6))",
            animation: "xa-scan 1.8s ease-in-out infinite",
          }}
        />
        {/* 粒子暗示（用点阵） */}
        <span
          className="absolute inset-0 pointer-events-none opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(rgba(30,45,36,0.35) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
          }}
        />
      </div>

      {/* 阶段标签 —— 三个点顺次点亮 */}
      <div className="flex items-center gap-2">
        <PhaseDot active={phaseIndex(phase) >= 0} />
        <PhaseDot active={phaseIndex(phase) >= 1} />
        <PhaseDot active={phaseIndex(phase) >= 2} />
      </div>

      <p className="text-[12px] text-[#5C6B61] tracking-wide">
        {PHASE_LABEL[phase]}
      </p>

      {/* 内联 keyframes:不侵入全局 css */}
      <style jsx>{`
        @keyframes xa-scan {
          0% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
          100% {
            top: 0%;
          }
        }
        @keyframes xa-breath {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function phaseIndex(p: AnalysisPhase): number {
  if (p === "locating") return 0;
  if (p === "analyzing") return 1;
  if (p === "modeling") return 2;
  return 3;
}

function PhaseDot({ active }: { active: boolean }) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full transition-colors ${
        active ? "bg-[#1E2D24]" : "bg-[#1E2D24]/20"
      }`}
      aria-hidden
    />
  );
}

/* ----------------- 揭幕：彩虹屁 + 选衣建议 ----------------- */

function RevealView({ result }: { result: AnalyzeResponse }) {
  // SKILL §2.1:严禁把 structured 字段渲染出来。
  const { compliments, suggestion } = result.qualitative;
  return (
    <div
      className="px-4 py-4 flex flex-col gap-3"
      style={{ animation: "xa-fade 400ms ease-out" }}
    >
      <div className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase text-[#5C6B61]/80">
        <Sparkles className="w-3 h-3" />
        今日形象
      </div>

      <ul className="flex flex-col gap-1.5">
        {compliments.map((c, i) => (
          <li
            key={i}
            className="text-[15px] leading-snug text-[#1E2D24]"
            style={{
              animation: `xa-fade 400ms ease-out ${i * 90}ms both`,
            }}
          >
            <span className="text-champagne-gradient font-semibold">
              {c}
            </span>
          </li>
        ))}
      </ul>

      {suggestion && (
        <div
          className="mt-1 flex items-start gap-1.5 rounded-lg bg-[#1E2D24]/[0.04] border border-[#D4C4A0]/70 px-3 py-2"
          style={{
            animation: `xa-fade 400ms ease-out ${compliments.length * 90}ms both`,
          }}
        >
          <Wand2 className="w-3.5 h-3.5 mt-0.5 text-[#C5A880] shrink-0" />
          <p className="text-[12px] leading-relaxed text-[#5C6B61]">
            {suggestion}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes xa-fade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/* ----------------- 错误态：静默降级(SKILL §5.2 已在 service 层兜底,理论上极少走到) ----------------- */

function ErrorView({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 text-[12px] text-[#5C6B61]/70">
      形象分析暂不可用（{message}），不影响后续生成。
    </div>
  );
}

export default AnalysisPanel;
