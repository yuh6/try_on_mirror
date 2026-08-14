"use client";

import { useEffect, useState } from "react";

interface DayCell {
  day: number;
  mood?: string; // 有值表示当天有通话
  urgent?: boolean;
  low?: boolean;
}

/** 关怀日历（原 board.html 内联脚本移植；挂载后计算避免 SSR 时差错位）。 */
export function CalendarCard() {
  const [cells, setCells] = useState<(DayCell | null)[]>([]);
  const [label, setLabel] = useState("");
  const [today, setToday] = useState(-1);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    const monthNames = [
      "1月", "2月", "3月", "4月", "5月", "6月",
      "7月", "8月", "9月", "10月", "11月", "12月",
    ];
    setLabel(`${year}年${monthNames[month]}`);
    setToday(now.getDate());

    const firstDay = new Date(year, month, 1).getDay(); // 0=周日
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 演示数据：三天 demo（8/10 平静、8/11 想念、8/12 紧急）
    const dayData: Record<number, string> = {
      10: "😌",
      11: "🥺",
      12: "🚨",
    };

    const result: (DayCell | null)[] = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const mood = dayData[d];
      result.push({
        day: d,
        mood,
        urgent: mood === "🚨",
        low: mood === "😔",
      });
    }
    setCells(result);
  }, []);

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
                border: c.day === today ? "1.5px solid #303030" : undefined,
                fontWeight: c.day === today ? 600 : undefined,
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
