/**
 * 极简账号系统：用户名+密码。
 * - 密码：scrypt 加盐哈希（node:crypto，无外部依赖）
 * - 会话：签名 Cookie（userId.expiry.HMAC），30 天有效，httpOnly
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SECRET =
  process.env.AUTH_SECRET || "xiaomianao-demo-secret-change-me-in-production";
export const SESSION_COOKIE = "xmn_session";
const SESSION_DAYS = 30;

/* ---------- 密码 ---------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = scryptSync(password, salt, 64);
  const expect = Buffer.from(hash, "hex");
  return calc.length === expect.length && timingSafeEqual(calc, expect);
}

/* ---------- 会话（无状态签名 Cookie） ---------- */

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function makeSessionToken(userId: string): string {
  const expiry = Date.now() + SESSION_DAYS * 86400_000;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, sig] = parts;
  if (sign(`${userId}.${expiry}`) !== sig) return null;
  if (Number(expiry) < Date.now()) return null;
  return userId;
}

/** 当前登录用户的 id（未登录返回 ""，即演示数据 owner） */
export async function getCurrentOwnerId(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token) ?? "";
}

/** 读取原始会话 token（给语音桥带凭证用；仅同源接口返回） */
export async function getSessionToken(): Promise<string> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? "";
}
