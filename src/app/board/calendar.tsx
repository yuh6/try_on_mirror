"use client";

export interface CalendarMood {
  date: string; // "YYYY-MM-DD"
  mood: string;
  note: string;
}

const MOOD_EMOJI: Record<string, string> = {
  平静: "😌",
  开心: "😊",
  低落: "😔",
  想念: "🥺",
  担忧: "😟",
  紧急: "🚨",
};

interface DayCell {
  day: number;
  mood?: string;
  urgent?: boolean;
  low?: boolean;
}

/**
 * 关怀日历：以服务器时间为准（不信任客户端时钟），
 * 有通话记录（心情）的日子标表情，今天高亮。
 */
export function CalendarCard({
  moods,
  todayISO,
}: {
  moods: CalendarMood[];
  todayISO: string; // "YYYY-MM-DD"（服务器的今天，东八区）
}) {
  const [y, m, d] = todayISO.split("-").map(Number);
  const year = y;
  const month = m - 1; // 0-11
  const todayDay = d;

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];
  const label = `${year}年${monthNames[month]}`;

  const firstDay = new Date(year, month, 1).getDay(); // 0=周日
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 数据库心情记录 → 当月日期 → 表情
  const monthPrefix = `${year}-${String(m).padStart(2, "0")}-`;
  const dayData: Record<number, string> = {};
  for (const mo of moods) {
    if (mo.date.startsWith(monthPrefix)) {
      const day = Number(mo.date.slice(8, 10));
      if (day >= 1 && day <= daysInMonth) {
        dayData[day] = MOOD_EMOJI[mo.mood] ?? "📝";
      }
    }
  }

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const mood = dayData[day];
    cells.push({ day, mood, urgent: mood === "🚨", low: mood === "😔" });
  }

  return (
    <div className="card p-4" style={{ flex: 1, minWidth: 240, maxWidth: 340 }}>
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="text-sm font-medium text-[#303030]">关怀日历</span>
          <span className="text-xs text-[#898989] ml-2">{label}</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <div key={d} className="text-center text-[10px] text-[#898989] pb-1">
            {d}
          </div>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <div
              key={c.day}
              className="rounded-md flex items-center justify-center gap-0.5 text-[11px] transition-all"
              style={{
                height: 28,
                background: c.mood
                  ? c.urgent
                    ? "rgba(192,57,43,0.1)"
                    : c.low
                      ? "rgba(137,137,137,0.1)"
                      : "rgba(255,216,95,0.15)"
                  : "rgba(255,255,255,0.3)",
                border: c.day === todayDay ? "1.5px solid #303030" : undefined,
                fontWeight: c.day === todayDay ? 600 : undefined,
              }}
            >
              <span className={c.mood ? "text-[#303030]" : "text-[#898989]"}>
                {c.day}
              </span>
              {c.mood && <span className="text-[10px]">{c.mood}</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
