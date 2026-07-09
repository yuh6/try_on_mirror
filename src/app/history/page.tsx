"use client";

import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { HistoryList } from "@/components/HistoryList";
import { useGenerations } from "@/hooks/useGenerations";

export default function HistoryPage() {
  const {
    items,
    loading,
    error,
    hasMore,
    initialLoaded,
    loadMore,
    remove,
  } = useGenerations();

  return (
    <main className="min-h-svh champagne-bg flex items-center justify-center p-4 sm:p-8">
      <div className="relative w-full max-w-[420px] sm:aspect-[9/16] bg-[#FAF5EB] sm:rounded-[32px] sm:shadow-2xl overflow-hidden film-grain flex flex-col">
        <div className="relative z-10 flex flex-col h-full overflow-y-auto">
          <header className="px-5 pt-8 pb-4 relative">
            <Link
              href="/"
              className="absolute top-8 left-5 w-9 h-9 rounded-full bg-[#1E2D24]/8 hover:bg-[#1E2D24]/15 text-[#1E2D24] flex items-center justify-center transition-colors"
              aria-label="返回"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E2D24]/8 border border-[#1E2D24]/15 text-[10px] tracking-[0.2em] uppercase text-[#1E2D24]/70 mb-3">
                <Camera className="w-3 h-3" />
                历史生成
              </div>
              <h1 className="text-[22px] leading-tight text-[#1E2D24] font-semibold">
                你的<span className="text-champagne-gradient font-bold">试穿档案</span>
              </h1>
              <p className="mt-1.5 text-[11px] text-[#5C6B61]">
                所有生成过的试穿大片都在这里
              </p>
            </div>
          </header>

          <div className="flex-1 px-5 pb-5">
            <HistoryList
              items={items}
              loading={loading}
              hasMore={hasMore}
              error={error}
              onLoadMore={loadMore}
              onDelete={remove}
              emptyLabel={
                initialLoaded && !loading ? "还没有生成记录，快去试试吧" : ""
              }
            />
          </div>

          <footer className="px-5 pb-4 pt-2 text-center">
            <p className="text-[10px] tracking-[0.15em] uppercase text-[#5C6B61]/50">
              Powered by Seedream 5.0
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
