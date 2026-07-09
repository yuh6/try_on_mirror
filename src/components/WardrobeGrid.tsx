"use client";

import { Check } from "lucide-react";
import type { WardrobeItem } from "@/lib/api-types";

export type WardrobeGridProps = {
  items: WardrobeItem[];
  selectedId?: string | null;
  onSelect: (item: WardrobeItem) => void;
  loading?: boolean;
  emptyLabel?: string;
  className?: string;
};

/**
 * Grid of wardrobe items — pure UI, no fetching.
 * Emits the whole item on select so callers can pick up id / url / category.
 */
export function WardrobeGrid({
  items,
  selectedId,
  onSelect,
  loading,
  emptyLabel = "这个分类还没有衣物",
  className,
}: WardrobeGridProps) {
  if (loading && items.length === 0) {
    return (
      <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/4] rounded-xl skeleton-shimmer"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={`h-32 flex items-center justify-center text-[12px] text-[#5C6B61]/70 ${className ?? ""}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      {items.map((item) => {
        const active = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`relative aspect-[3/4] rounded-xl overflow-hidden border transition-all active:scale-[0.98] ${
              active
                ? "border-[#1E2D24] ring-2 ring-[#C5A880]"
                : "border-[#D4C4A0] hover:border-[#C5A880]"
            }`}
            aria-pressed={active}
            title={item.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-[#1E2D24]/75 to-transparent text-[10px] text-[#FAF5EB] text-left truncate">
              {item.name}
            </span>
            {active && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#1E2D24] text-[#FAF5EB] flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default WardrobeGrid;
