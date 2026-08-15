/**
 * 家庭留言板数据层（移植自 callinggrandma 的 src/family_board.py）。
 *
 * Flask 版读写 family_board.json；这里改为 Turso/libsql 数据库。
 * 对外的数据结构与 Flask 版 /api/data 完全一致。
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  boardMessages,
  boardReports,
  boardTodos,
  boardMoods,
  elderProfiles,
} from "@/db/schema";
import { EMPTY_ELDER_PROFILE, type ElderProfile } from "./elder-profile";

/* ---------- 时间与 ID 工具（与 Python 版格式一致） ---------- */

/** 当前时间字符串（东八区，"YYYY-MM-DD HH:mm:ss"）。 */
export function nowStr(): string {
  return formatDateTime(new Date());
}

/** 今天的日期字符串（"YYYY-MM-DD"）。 */
export function todayStr(): string {
  return formatDateTime(new Date()).slice(0, 10);
}

function formatDateTime(d: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function genId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/* ---------- 对外数据结构（与 Flask 版 JSON 一致） ---------- */

export interface BoardMessage {
  id: string;
  from: string;
  text: string;
  time: string;
  delivered: boolean;
}

export interface BoardReport {
  id: string;
  time: string;
  summary: string;
  mood: string;
  details: string;
}

export interface BoardTodo {
  id: string;
  text: string;
  done: boolean;
  time: string;
}

export interface BoardMood {
  date: string;
  mood: string;
  note: string;
  time: string;
}

export interface BoardStats {
  total_messages: number;
  undelivered_count: number;
  total_reports: number;
  pending_todos: number;
  mood_records: number;
}

/* ---------- 留言 ---------- */

export async function addMessage(text: string, fromWho = "子女"): Promise<BoardMessage> {
  const msg: BoardMessage = {
    id: genId(),
    from: fromWho,
    text,
    time: nowStr(),
    delivered: false,
  };
  await db.insert(boardMessages).values({
    id: msg.id,
    fromWho: msg.from,
    text: msg.text,
    time: msg.time,
    delivered: false,
  });
  return msg;
}

export async function getAllMessages(): Promise<BoardMessage[]> {
  const rows = await db
    .select()
    .from(boardMessages)
    .orderBy(desc(boardMessages.time));
  return rows.map((r) => ({
    id: r.id,
    from: r.fromWho,
    text: r.text,
    time: r.time,
    delivered: r.delivered,
  }));
}

/* ---------- 汇报 ---------- */

export async function addReport(
  summary: string,
  mood = "",
  details = ""
): Promise<BoardReport> {
  const report: BoardReport = {
    id: genId(),
    time: nowStr(),
    summary,
    mood,
    details,
  };
  await db.insert(boardReports).values(report);
  return report;
}

export async function getAllReports(): Promise<BoardReport[]> {
  const rows = await db
    .select()
    .from(boardReports)
    .orderBy(desc(boardReports.time));
  return rows.map((r) => ({
    id: r.id,
    time: r.time,
    summary: r.summary,
    mood: r.mood,
    details: r.details,
  }));
}

/* ---------- 待办 ---------- */

export async function getAllTodos(): Promise<BoardTodo[]> {
  const rows = await db
    .select()
    .from(boardTodos)
    .orderBy(desc(boardTodos.time));
  // 未完成的排在前面（与 Python 版一致）
  return rows
    .map((r) => ({ id: r.id, text: r.text, done: r.done, time: r.time }))
    .sort((a, b) => Number(a.done) - Number(b.done));
}

/* ---------- 心情 ---------- */

export async function addMood(mood: string, note = ""): Promise<BoardMood> {
  const record: BoardMood = {
    date: todayStr(),
    mood,
    note,
    time: nowStr(),
  };
  // 同一天只保留最新一条（date 是主键，upsert 覆盖）
  await db
    .insert(boardMoods)
    .values(record)
    .onConflictDoUpdate({ target: boardMoods.date, set: record });
  return record;
}

export async function getAllMoods(): Promise<BoardMood[]> {
  const rows = await db.select().from(boardMoods).orderBy(desc(boardMoods.date));
  return rows.map((r) => ({ date: r.date, mood: r.mood, note: r.note, time: r.time }));
}

/* ---------- 统计 ---------- */

export async function getStats(): Promise<BoardStats> {
  const [messages, reports, todos, moods] = await Promise.all([
    getAllMessages(),
    getAllReports(),
    getAllTodos(),
    getAllMoods(),
  ]);
  return {
    total_messages: messages.length,
    undelivered_count: messages.filter((m) => !m.delivered).length,
    total_reports: reports.length,
    pending_todos: todos.filter((t) => !t.done).length,
    mood_records: moods.length,
  };
}

/* ---------- 老人档案（单行 JSON 文档） ---------- */

const PROFILE_ID = "main";

export async function loadElderProfile(): Promise<ElderProfile> {
  const rows = await db
    .select()
    .from(elderProfiles)
    .where(eq(elderProfiles.id, PROFILE_ID));
  if (rows.length === 0) return { ...EMPTY_ELDER_PROFILE };
  try {
    return { ...EMPTY_ELDER_PROFILE, ...JSON.parse(rows[0].data) };
  } catch {
    return { ...EMPTY_ELDER_PROFILE };
  }
}

export async function saveElderProfile(profile: ElderProfile): Promise<void> {
  const data = JSON.stringify(profile);
  const existing = await db
    .select({ id: elderProfiles.id })
    .from(elderProfiles)
    .where(eq(elderProfiles.id, PROFILE_ID));
  if (existing.length > 0) {
    await db
      .update(elderProfiles)
      .set({ data, updatedAt: new Date() })
      .where(eq(elderProfiles.id, PROFILE_ID));
  } else {
    await db.insert(elderProfiles).values({ id: PROFILE_ID, data });
  }
}

/* ---------- 汇总（/api/data） ---------- */

export async function getAllData() {
  const [profile, messages, reports, todos, moods] = await Promise.all([
    loadElderProfile(),
    getAllMessages(),
    getAllReports(),
    getAllTodos(),
    getAllMoods(),
  ]);
  return {
    elder_profile: profile,
    messages,
    reports,
    todos,
    moods,
  };
}
