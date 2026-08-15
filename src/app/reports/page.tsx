import Link from "next/link";
import { getAllReports, getAllTodos } from "@/lib/family-board";
import { getCurrentOwnerId } from "@/lib/auth";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";

const MOOD_EMOJI: Record<string, string> = {
  平静: "😌",
  开心: "😊",
  低落: "😔",
  想念: "🥺",
  担忧: "😟",
  恐惧: "😨",
  紧急: "🚨",
  平稳: "😌",
  平稳偏愉快: "😊",
};

export default async function ReportsPage() {
  const owner = await getCurrentOwnerId();
  const [reports, todos] = await Promise.all([
    getAllReports(owner),
    getAllTodos(owner),
  ]);

  return (
    <main className="font-zh min-h-screen" style={{ background: "#E3E5E6" }}>
      {/* 固定背景（暖黄色块） */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
        viewBox="0 0 1280 832"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width="1280" height="832" fill="#E3E5E6" />
        <defs>
          <filter id="blob" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="180" />
          </filter>
        </defs>
        <path
          d="M904 404C942.8 189.6 1234.83 123.333 1376 117V1093.5H-227V792.5C-161.5 706.167 0.5 556.6 124.5 649C248.5 741.4 473.833 727.5 571 709C665.833 696.667 865.2 618.4 904 404Z"
          fill="#FFD85F"
          opacity="0.5"
          filter="url(#blob)"
        />
      </svg>

      <div className="relative z-10 max-w-[900px] mx-auto px-4 sm:px-6 py-6">
        {/* 导航 */}
        <nav className="flex items-center justify-between mb-6">
          <Link href="/" className="pill px-5 py-2 text-[#303030] text-base select-none">
            小棉袄
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex pill px-1 py-1 gap-1 shadow-sm">
              <Link
                href="/board"
                className="px-4 py-2 rounded-full text-sm text-[#898989] hover:text-[#303030] transition-colors"
              >
                看板
              </Link>
              <Link href="/reports" className="pill-active px-4 py-2 rounded-full text-sm">
                汇报
              </Link>
              <Link
                href="/profile"
                className="px-4 py-2 rounded-full text-sm text-[#898989] hover:text-[#303030] transition-colors"
              >
                档案
              </Link>
            </div>
          </div>
        </nav>

        {/* 标题行 */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#303030] leading-tight">
              小棉的通话汇报
            </h1>
            <p className="text-[#898989] text-sm mt-2">
              每次通话后，小棉会在这里记录老人的状态
            </p>
          </div>
          <div className="text-xs text-[#898989] flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FFD85F] rounded-full animate-pulse"></span>
            每 10 秒自动刷新
          </div>
        </div>

        {/* 汇报卡片列表 */}
        {reports.length > 0 ? (
          <div className="flex flex-col gap-3">
            {reports.slice(0, 15).map((r) => {
              const isUrgent =
                r.summary.includes("🚨") || r.mood.includes("紧急");
              return (
                <div
                  key={r.id}
                  className={`card p-5 fade-in ${
                    isUrgent ? "border-2 border-[#c0392b]/30" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${
                          isUrgent ? "bg-[#c0392b]/15" : "bg-[#898989]/15"
                        } flex items-center justify-center text-lg`}
                      >
                        {isUrgent ? "🚨" : "📞"}
                      </div>
                      <div>
                        <div className="text-sm text-[#303030] font-medium">
                          {r.summary.slice(0, 60)}
                          {r.summary.length > 60 ? "..." : ""}
                        </div>
                        <div className="text-xs text-[#898989] mt-0.5">{r.time}</div>
                      </div>
                    </div>
                    {r.mood && (
                      <span
                        className={`${
                          isUrgent ? "bg-[#c0392b] text-white" : "yellow-accent"
                        } rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap`}
                      >
                        {MOOD_EMOJI[r.mood] ?? "📝"} {r.mood}
                      </span>
                    )}
                  </div>

                  {r.details && (
                    <details className="mt-3">
                      <summary className="text-sm text-[#303030] cursor-pointer hover:opacity-70 select-none">
                        查看完整报告 ↓
                      </summary>
                      <div className="mt-3 bg-[#303030] rounded-2xl p-5 overflow-x-auto">
                        <pre className="text-white/80 text-sm whitespace-pre-wrap font-sans leading-relaxed">
                          {r.details}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <div className="text-5xl mb-4">📋</div>
            <div className="text-lg text-[#303030] mb-2">还没有汇报</div>
            <div className="text-sm text-[#898989]">
              通话结束后，小棉会自动在这里记录
            </div>
          </div>
        )}

        {/* 待办区 */}
        {todos.length > 0 && (
          <div className="mt-6 card p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg text-[#303030]">建议事项</span>
              <span className="text-sm text-[#898989]">{todos.length} 条</span>
            </div>
            {todos.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-3 border-b border-[#898989]/10 last:border-0"
              >
                <div
                  className={`w-6 h-6 rounded-full ${
                    t.done ? "yellow-accent" : "border border-[#898989]/30"
                  } flex items-center justify-center flex-shrink-0`}
                >
                  {t.done && <span className="text-xs">✓</span>}
                </div>
                <span
                  className={`text-sm ${
                    t.done ? "line-through text-[#898989]" : "text-[#303030]"
                  } flex-1`}
                >
                  {t.text}
                </span>
                <span className="text-xs text-[#898989]">{t.time.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="h-6"></div>
      </div>

      <AutoRefresh />

      <style>{`
        .card {
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 24px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.06);
        }
        .pill {
          border: 1px solid rgba(137,137,137,0.2);
          background: rgba(255,255,255,0.6);
          border-radius: 9999px;
        }
        .pill-active { background: #303030; color: white; border-color: #303030; }
        .yellow-accent { background: #FFD85F; color: #303030; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease; }
      `}</style>
    </main>
  );
}
