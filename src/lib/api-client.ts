// Type-safe fetch client for MirrorMag API.
// One function per endpoint declared in docs/DESIGN.md §3.
// Non-2xx responses throw ApiError (status + code + message).

import type {
  CreateWardrobeItemRequest,
  CreateWardrobeItemResponse,
  GenerateRequest,
  GenerateResponse,
  Generation,
  ListGenerationsQuery,
  ListGenerationsResponse,
  OkResponse,
  WardrobeListResponse,
} from "./api-types";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type FetchOptions = {
  signal?: AbortSignal;
};

async function request<T>(
  input: string,
  init: RequestInit & FetchOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ApiError(0, err instanceof Error ? err.message : "网络请求失败");
  }

  // Try to parse body regardless of status; the API always returns JSON.
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // fallthrough — treat as opaque error
    }
  }

  if (!res.ok) {
    const errBody = (body ?? {}) as { error?: string; code?: string };
    throw new ApiError(
      res.status,
      errBody.error || `请求失败 (${res.status})`,
      errBody.code,
    );
  }

  return body as T;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  ) as [string, string | number][];
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.set(k, String(v));
  return `?${usp.toString()}`;
}

// ─── Wardrobe ────────────────────────────────────────────────────────────────

export function listWardrobe(
  category?: string,
  opts: FetchOptions = {},
): Promise<WardrobeListResponse> {
  const qs = buildQuery({ category });
  return request<WardrobeListResponse>(`/api/wardrobe${qs}`, {
    method: "GET",
    signal: opts.signal,
  });
}

export function createWardrobeItem(
  payload: CreateWardrobeItemRequest,
  opts: FetchOptions = {},
): Promise<CreateWardrobeItemResponse> {
  return request<CreateWardrobeItemResponse>(`/api/wardrobe`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
}

export function deleteWardrobeItem(
  id: string,
  opts: FetchOptions = {},
): Promise<OkResponse> {
  return request<OkResponse>(`/api/wardrobe/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal: opts.signal,
  });
}

// ─── Generate ────────────────────────────────────────────────────────────────

export function generate(
  payload: GenerateRequest,
  opts: FetchOptions = {},
): Promise<GenerateResponse> {
  return request<GenerateResponse>(`/api/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
}

// ─── Generations (history) ───────────────────────────────────────────────────

export function listGenerations(
  params: ListGenerationsQuery = {},
  opts: FetchOptions = {},
): Promise<ListGenerationsResponse> {
  const qs = buildQuery({
    limit: params.limit,
    cursor: params.cursor,
    status: params.status,
  });
  return request<ListGenerationsResponse>(`/api/generations${qs}`, {
    method: "GET",
    signal: opts.signal,
  });
}

export function deleteGeneration(
  id: string,
  opts: FetchOptions = {},
): Promise<OkResponse> {
  return request<OkResponse>(`/api/generations/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal: opts.signal,
  });
}

// Re-export types for callers that want to `import { WardrobeItem } from '@/lib/api-client'`.
export type {
  CreateWardrobeItemRequest,
  CreateWardrobeItemResponse,
  GenerateRequest,
  GenerateResponse,
  Generation,
  ListGenerationsQuery,
  ListGenerationsResponse,
  OkResponse,
  WardrobeListResponse,
} from "./api-types";
