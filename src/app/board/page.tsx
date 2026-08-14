import Link from "next/link";
import { getAllData, getStats } from "@/lib/family-board";
import { MessageForm } from "./message-form";
import { CalendarCard } from "./calendar";

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

export default async function BoardPage() {
  const [{ elder_profile: profile, messages, reports, todos, moods }, stats] =
    await Promise.all([getAllData(), getStats()]);

  const latestMood = moods[0];
  const latestReport = reports[0];
  const doneCount = todos.filter((t) => t.done).length;

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

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
        {/* 导航 */}
        <nav className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="pill px-5 py-2 text-[#303030] text-base select-none"
          >
            小棉袄
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex pill px-1 py-1 gap-1 shadow-sm">
              <Link href="/board" className="pill-active px-4 py-2 rounded-full text-sm">
                看板
              </Link>
              <Link
                href="/reports"
                className="px-4 py-2 rounded-full text-sm text-[#898989] hover:text-[#303030] transition-colors"
              >
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

        {/* 欢迎行 */}
        <div className="w-full mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8">
          <div className="flex-[3]">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl tracking-tight text-[#303030] leading-tight">
              {profile.title || "老人"}今天的状态
            </h1>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {latestMood ? (
                <span className="yellow-accent rounded-full px-4 py-2 text-sm font-medium">
                  {MOOD_EMOJI[latestMood.mood] ?? "📝"} {latestMood.mood}
                </span>
              ) : (
                <span className="pill px-4 py-2 text-sm text-[#898989]">
                  暂无记录
                </span>
              )}
              {latestMood?.note && (
                <span className="pill px-4 py-2 text-sm text-[#898989]">
                  {latestMood.note.slice(0, 20)}
                </span>
              )}
            </div>
          </div>
          <div className="flex-[2] flex gap-6 sm:gap-8">
            <Stat icon="📞" value={stats.total_reports} label="通话次数" />
            <Stat icon="💬" value={stats.undelivered_count} label="未读留言" />
            <Stat icon="✅" value={stats.pending_todos} label="待办事项" />
          </div>
        </div>

        {/* 第一排 4 个卡片 */}
        <div className="flex flex-wrap gap-3 mb-3">
          {/* 老人状态卡 */}
          <div
            className="card overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.10)]"
            style={{ width: "100%", flex: 1, minWidth: 220, maxWidth: 280 }}
          >
            <div className="relative" style={{ height: 340 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/static/oldman.jpg"
                alt="老人"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 16,
                  paddingTop: 48,
                  background:
                    "linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ color: "white", fontSize: 16, fontWeight: 500 }}>
                      {profile.title || "老人"}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {profile.age ? `${profile.age}岁` : ""} · {profile.living || ""}
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.35)",
                      borderRadius: 9999,
                      padding: "4px 12px",
                      color: "white",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {latestMood
                      ? `${MOOD_EMOJI[latestMood.mood] ?? "📝"} ${latestMood.mood}`
                      : "--"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 今日通话总结 */}
          <div
            className="card p-5 flex flex-col gap-3"
            style={{ flex: 1, minWidth: 200, maxWidth: 280 }}
          >
            <div className="flex justify-between items-center">
              <span className="text-lg text-[#303030]">今日通话总结</span>
            </div>
            {latestReport ? (
              <>
                <div>
                  {latestReport.mood && (
                    <span className="yellow-accent rounded-full px-3 py-1 text-xs font-medium">
                      {MOOD_EMOJI[latestReport.mood] ?? "📝"} {latestReport.mood}
                    </span>
                  )}
                </div>
                <div className="text-sm text-[#303030] leading-relaxed">
                  {latestReport.summary}
                </div>
                <div className="text-xs text-[#898989] mt-auto">
                  {latestReport.time.slice(0, 10)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center py-4">
                <span className="text-xs text-[#898989]">
                  通话结束后
                  <br />
                  AI 总结会显示在这里
                </span>
              </div>
            )}
          </div>

          {/* 待办事项 */}
          <div
            className="card p-5 flex flex-col gap-2"
            style={{ flex: 1, minWidth: 200, maxWidth: 280 }}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-lg text-[#303030]">待办事项</span>
              <span className="text-sm text-[#898989]">
                {doneCount}/{todos.length}
              </span>
            </div>
            {todos.length > 0 ? (
              todos.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2 border-b border-[#898989]/10 last:border-0"
                >
                  <div
                    className={`w-5 h-5 rounded-full ${
                      t.done ? "yellow-accent" : "border border-[#898989]/30"
                    } flex items-center justify-center flex-shrink-0`}
                  >
                    {t.done && <span className="text-[10px]">✓</span>}
                  </div>
                  <span
                    className={`text-sm ${
                      t.done ? "line-through text-[#898989]" : "text-[#303030]"
                    } flex-1`}
                  >
                    {t.text}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#898989] py-2">暂无待办 👍</div>
            )}
          </div>

          {/* 最新汇报 */}
          <div
            className="card p-5 flex flex-col gap-3"
            style={{ flex: 1, minWidth: 200, maxWidth: 280 }}
          >
            <div className="flex justify-between items-center">
              <span className="text-lg text-[#303030]">最新汇报</span>
              <Link
                href="/reports"
                className="text-sm text-[#898989] hover:text-[#303030]"
              >
                全部 →
              </Link>
            </div>
            {latestReport ? (
              <div className="bg-[#303030] rounded-3xl p-5 flex flex-col gap-3 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-base text-white">本次通话</span>
                  <span className="text-xs text-[#898989]">
                    {latestReport.time.slice(0, 10)}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {latestReport.mood && (
                    <span className="yellow-accent rounded-full px-3 py-1 text-xs font-medium">
                      {MOOD_EMOJI[latestReport.mood] ?? "📝"} {latestReport.mood}
                    </span>
                  )}
                  <span className="border border-white/20 rounded-full px-3 py-1 text-xs text-white/70">
                    📞 通话报告
                  </span>
                </div>
                <div className="text-white text-sm leading-relaxed mt-2">
                  {latestReport.summary}
                </div>
                {latestReport.details && (
                  <details className="mt-1">
                    <summary className="text-xs text-[#FFD85F] cursor-pointer hover:opacity-80">
                      查看完整报告 →
                    </summary>
                    <pre className="text-white/60 text-xs mt-2 whitespace-pre-wrap font-sans leading-relaxed max-h-[180px] overflow-y-auto">
                      {latestReport.details}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="bg-[#898989]/10 rounded-3xl p-6 text-center flex-1 flex flex-col items-center justify-center">
                <span className="text-2xl mb-2">📋</span>
                <span className="text-xs text-[#898989]">
                  通话结束后
                  <br />
                  小棉会在这里汇报
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 第二排：留言互动 */}
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="card overflow-hidden" style={{ flex: 1, minWidth: 300 }}>
            <div className="p-5 pb-3 flex justify-between items-center">
              <span className="text-lg text-[#303030]">给老人的留言</span>
              <span className="text-sm text-[#898989]">{messages.length} 条</span>
            </div>
            <MessageForm />
            <div className="max-h-[200px] overflow-y-auto">
              {messages.length > 0 ? (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="px-5 py-3 border-t border-[#898989]/10 flex items-start gap-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-full ${
                        m.delivered ? "yellow-accent" : "bg-[#898989]/15"
                      } flex items-center justify-center flex-shrink-0 text-sm`}
                    >
                      {m.delivered ? "✓" : "✉"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[#303030]">{m.text}</div>
                      <div className="text-xs text-[#898989] mt-1">
                        {m.from} · {m.time.slice(5, 16)}
                        {m.delivered ? (
                          " · 已转告"
                        ) : (
                          <>
                            {" · "}
                            <span className="yellow-accent px-2 py-0.5 rounded-full text-[10px]">
                              待转告
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-6 text-center text-sm text-[#898989]">
                  还没有留言，写一句吧
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 本周总结 + 日历并排 */}
        <div className="flex flex-wrap gap-3 mt-3 items-start">
          {/* 本周总结 */}
          <div
            className="card p-5 flex flex-col gap-3"
            style={{ flex: 1, minWidth: 240, maxWidth: 340 }}
          >
            <span className="text-lg text-[#303030]">本周总结</span>
            <div className="flex flex-col gap-3">
              <WeeklyRow date="8/10" mood="😌 平静" urgent={false} text="降温下雨居家，看戏曲频道，降压药延迟1次" />
              <WeeklyRow date="8/11" mood="🥺 想念" urgent={false} text="想念儿子，下午和刘姨王姨打牌，预约回忆录" />
              <WeeklyRow date="8/12" mood="🚨 紧急" urgent={true} text="厕所滑倒，腰疼腿麻，小王陪同就医" />
            </div>
          </div>

          <CalendarCard />
        </div>

        <div className="h-6"></div>
      </div>

      {/* 看板页专属样式 */}
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
      `}</style>
    </main>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div>
      <div className="bg-[#898989]/15 rounded-lg p-1.5 mb-1 inline-block">{icon}</div>
      <div className="text-3xl sm:text-4xl text-[#303030] leading-none">{value}</div>
      <div className="text-xs text-[#898989] mt-1">{label}</div>
    </div>
  );
}

function WeeklyRow({
  date,
  mood,
  urgent,
  text,
}: {
  date: string;
  mood: string;
  urgent: boolean;
  text: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="text-xs text-[#898989] whitespace-nowrap pt-0.5">{date}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${
          urgent ? "" : "yellow-accent"
        }`}
        style={urgent ? { background: "#c0392b", color: "white" } : undefined}
      >
        {mood}
      </span>
      <span className="text-xs text-[#535557] leading-relaxed">{text}</span>
    </div>
  );
}
