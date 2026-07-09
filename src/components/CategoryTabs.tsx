"use client";

import type { WardrobeCategory } from "@/lib/api-types";

export type CategoryTabsProps = {
  categories: WardrobeCategory[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  showAll?: boolean;
  className?: string;
};

/**
 * Horizontal scrollable pill tabs for wardrobe categories.
 * `activeId === null` means the "全部" tab.
 */
export function CategoryTabs({
  categories,
  activeId,
  onSelect,
  showAll = true,
  className,
}: CategoryTabsProps) {
  return (
    <div
      className={`flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 ${className ?? ""}`}
    >
      {showAll && (
        <TabButton
          active={activeId === null}
          onClick={() => onSelect(null)}
          label="全部"
        />
      )}
      {categories.map((cat) => (
        <TabButton
          key={cat.id}
          active={activeId === cat.id}
          onClick={() => onSelect(cat.id)}
          label={cat.name}
        />
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3 h-8 rounded-full text-[12px] tracking-wide transition-colors ${
        active
          ? "bg-[#1E2D24] text-[#FAF5EB]"
          : "bg-[#1E2D24]/8 text-[#1E2D24]/70 hover:bg-[#1E2D24]/15"
      }`}
    >
      {label}
    </button>
  );
}

export default CategoryTabs;
