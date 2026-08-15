/**
 * 家庭留言板数据层（多账号版）。
 *
 * owner = ""  → 演示数据（张阿姨）
 * owner = userId → 该注册用户的私有数据
 * 所有读写都按 owner 隔离。
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
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

/* ---------- 对外数据结构（字段与原 JSON 一致） ---------- */

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

export async function addMessage(
  owner: string,
  text: string,
  fromWho = "子女"
): Promise<BoardMessage> {
  const msg: BoardMessage = {
    id: genId(),
    from: fromWho,
    text,
    time: nowStr(),
    delivered: false,
  };
  await db.insert(boardMessages).values({
    id: msg.id,
    owner,
    fromWho: msg.from,
    text: msg.text,
    time: msg.time,
    delivered: false,
  });
  return msg;
}

export async function getAllMessages(owner: string): Promise<BoardMessage[]> {
  const rows = await db
    .select()
    .from(boardMessages)
    .where(eq(boardMessages.owner, owner))
    .orderBy(desc(boardMessages.time));
  return rows.map((r) => ({
    id: r.id,
    from: r.fromWho,
    text: r.text,
    time: r.time,
    delivered: r.delivered,
  }));
}

export async function deleteMessage(owner: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(boardMessages)
    .where(and(eq(boardMessages.owner, owner), eq(boardMessages.id, id)))
    .returning({ id: boardMessages.id });
  return deleted.length > 0;
}

/* ---------- 汇报 ---------- */

export async function addReport(
  owner: string,
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
  await db.insert(boardReports).values({ ...report, owner });
  return report;
}

export async function getAllReports(owner: string): Promise<BoardReport[]> {
  const rows = await db
    .select()
    .from(boardReports)
    .where(eq(boardReports.owner, owner))
    .orderBy(desc(boardReports.time));
  return rows.map((r) => ({
    id: r.id,
    time: r.time,
    summary: r.summary,
    mood: r.mood,
    details: r.details,
  }));
}

export async function deleteReport(owner: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(boardReports)
    .where(and(eq(boardReports.owner, owner), eq(boardReports.id, id)))
    .returning({ id: boardReports.id });
  return deleted.length > 0;
}

/* ---------- 待办 ---------- */

export async function getAllTodos(owner: string): Promise<BoardTodo[]> {
  const rows = await db
    .select()
    .from(boardTodos)
    .where(eq(boardTodos.owner, owner))
    .orderBy(desc(boardTodos.time));
  return rows
    .map((r) => ({ id: r.id, text: r.text, done: r.done, time: r.time }))
    .sort((a, b) => Number(a.done) - Number(b.done));
}

/* ---------- 心情 ---------- */

export async function addMood(
  owner: string,
  mood: string,
  note = ""
): Promise<BoardMood> {
  const record: BoardMood = {
    date: todayStr(),
    mood,
    note,
    time: nowStr(),
  };
  await db
    .insert(boardMoods)
    .values({ ...record, owner })
    .onConflictDoUpdate({
      target: [boardMoods.owner, boardMoods.date],
      set: { mood, note, time: record.time },
    });
  return record;
}

export async function getAllMoods(owner: string): Promise<BoardMood[]> {
  const rows = await db
    .select()
    .from(boardMoods)
    .where(eq(boardMoods.owner, owner))
    .orderBy(desc(boardMoods.date));
  return rows.map((r) => ({
    date: r.date,
    mood: r.mood,
    note: r.note,
    time: r.time,
  }));
}

export async function deleteMood(owner: string, date: string): Promise<boolean> {
  const deleted = await db
    .delete(boardMoods)
    .where(and(eq(boardMoods.owner, owner), eq(boardMoods.date, date)))
    .returning({ date: boardMoods.date });
  return deleted.length > 0;
}

/* ---------- 统计 ---------- */

export async function getStats(owner: string): Promise<BoardStats> {
  const [messages, reports, todos, moods] = await Promise.all([
    getAllMessages(owner),
    getAllReports(owner),
    getAllTodos(owner),
    getAllMoods(owner),
  ]);
  return {
    total_messages: messages.length,
    undelivered_count: messages.filter((m) => !m.delivered).length,
    total_reports: reports.length,
    pending_todos: todos.filter((t) => !t.done).length,
    mood_records: moods.length,
  };
}

/* ---------- 老人档案（每个 owner 一行） ---------- */

function profileId(owner: string): string {
  return owner ? `u_${owner}` : "main";
}

export async function loadElderProfile(owner: string): Promise<ElderProfile> {
  const rows = await db
    .select()
    .from(elderProfiles)
    .where(eq(elderProfiles.owner, owner));
  if (rows.length === 0) return { ...EMPTY_ELDER_PROFILE };
  try {
    return { ...EMPTY_ELDER_PROFILE, ...JSON.parse(rows[0].data) };
  } catch {
    return { ...EMPTY_ELDER_PROFILE };
  }
}

export async function saveElderProfile(
  owner: string,
  profile: ElderProfile
): Promise<void> {
  const data = JSON.stringify(profile);
  const existing = await db
    .select({ id: elderProfiles.id })
    .from(elderProfiles)
    .where(eq(elderProfiles.owner, owner));
  if (existing.length > 0) {
    await db
      .update(elderProfiles)
      .set({ data, updatedAt: new Date() })
      .where(eq(elderProfiles.owner, owner));
  } else {
    await db
      .insert(elderProfiles)
      .values({ id: profileId(owner), owner, data });
  }
}

/* ---------- 汇总（/api/data） ---------- */

export async function getAllData(owner: string) {
  const [profile, messages, reports, todos, moods] = await Promise.all([
    loadElderProfile(owner),
    getAllMessages(owner),
    getAllReports(owner),
    getAllTodos(owner),
    getAllMoods(owner),
  ]);
  return {
    elder_profile: profile,
    messages,
    reports,
    todos,
    moods,
  };
}
