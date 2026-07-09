"use client";

import { AlertCircle, ExternalLink, Trash2 } from "lucide-react";
import type { Generation } from "@/lib/api-types";

export type HistoryListProps = {
  items: Generation[];
  loading?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  emptyLabel?: string;
  className?: string;
};

const fmtDate = (ts: number) => {
  try {
    return new Date(ts).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
};

const sourceLabel = (src: Generation["clothingSource"]) =>
  src === "wardrobe" ? "衣橱" : "上传";

/**
 * Generation history list — pure UI.
 * Displays each generation as a card with the output image (or failure state),
 * clothing source, timestamp, latency, and a delete button.
 */
export function HistoryList({
  items,
  loading,
  hasMore,
  error,
  onLoadMore,
  onDelete,
  emptyLabel = "还没有生成记录",
  className,
}: HistoryListProps) {
  if (loading && items.length === 0) {
    return (
      <div className={`space-y-3 ${className ?? ""}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-2xl skeleton-shimmer"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div
        className={`rounded-xl bg-[#B22222]/8 border border-[#B22222]/25 px-4 py-3 text-[12px] text-[#B22222] flex items-center gap-2 ${className ?? ""}`}
      >
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`h-40 flex items-center justify-center text-[12px] text-[#5C6B61]/70 ${className ?? ""}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {items.map((item) => (
        <HistoryRow key={item.id} item={item} onDelete={onDelete} />
      ))}

      {error && (
        <div className="rounded-xl bg-[#B22222]/8 border border-[#B22222]/25 px-4 py-2 text-[11px] text-[#B22222] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="w-full h-11 rounded-full border border-[#1E2D24]/20 text-[#1E2D24] text-[13px] hover:bg-[#1E2D24]/5 transition-colors disabled:opacity-50"
        >
          {loading ? "加载中…" : "加载更多"}
        </button>
      )}
      {!hasMore && items.length > 0 && (
        <p className="text-center text-[11px] text-[#5C6B61]/60 pt-2">
          — 到底啦 —
        </p>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  onDelete,
}: {
  item: Generation;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const failed = item.status === "failed";
  const handleDelete = async () => {
    if (!onDelete) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定要删除这条生成记录吗？")
    ) {
      return;
    }
    await onDelete(item.id);
  };

  return (
    <div className="flex gap-3 rounded-2xl bg-white/60 border border-[#D4C4A0]/50 p-3">
      <div className="w-20 h-24 rounded-xl overflow-hidden bg-[#1E2D24]/5 shrink-0 relative">
        {item.outputUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.outputUrl}
            alt="生成结果"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#B22222]">
            <AlertCircle className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] tracking-wide ${
                  failed
                    ? "bg-[#B22222]/12 text-[#B22222]"
                    : "bg-[#1E2D24]/10 text-[#1E2D24]"
                }`}
              >
                {failed ? "失败" : "成功"}
              </span>
              <span className="text-[#5C6B61]">
                衣物来源：{sourceLabel(item.clothingSource)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#5C6B61]/80">
              {fmtDate(item.createdAt)} · {(item.latencyMs / 1000).toFixed(1)}s
            </p>
            {failed && item.errorMessage && (
              <p className="mt-1 text-[11px] text-[#B22222] line-clamp-2">
                {item.errorMessage}
              </p>
            )}
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-7 h-7 shrink-0 rounded-full text-[#5C6B61] hover:text-[#B22222] hover:bg-[#B22222]/8 flex items-center justify-center transition-colors"
              aria-label="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {item.outputUrl && (
          <a
            href={item.outputUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#1E2D24]/70 hover:text-[#1E2D24]"
          >
            <ExternalLink className="w-3 h-3" />
            查看原图
          </a>
        )}
      </div>
    </div>
  );
}

export default HistoryList;
