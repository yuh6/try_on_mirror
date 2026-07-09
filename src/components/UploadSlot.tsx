"use client";

import { Upload, X } from "lucide-react";

export type UploadSlotProps = {
  label: string;
  icon: string;
  image: string | null;
  onClick: () => void;
  onClear: () => void;
  aspect?: "portrait" | "square";
  className?: string;
};

/**
 * Pure display component — no fetch side-effects.
 * Renders an upload dropzone; when `image` is set, previews it with a clear button.
 */
export function UploadSlot({
  label,
  icon,
  image,
  onClick,
  onClear,
  aspect = "portrait",
  className,
}: UploadSlotProps) {
  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[9/16]";
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-[#5C6B61] px-1">
        {icon} {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        className={`relative ${aspectClass} rounded-2xl border-2 border-dashed border-[#C5A880]/70 bg-white/60 backdrop-blur overflow-hidden flex items-center justify-center hover:border-[#C5A880] active:scale-[0.98] transition-all group`}
      >
        {image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={label}
              className="w-full h-full object-cover"
            />
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#1E2D24]/70 hover:bg-[#1E2D24]/90 text-[#FAF5EB] flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-[#5C6B61]/70 group-hover:text-[#1E2D24] transition-colors px-2 text-center">
            <Upload className="w-7 h-7" />
            <span className="text-[11px]">点击上传</span>
          </div>
        )}
      </button>
    </div>
  );
}

export default UploadSlot;
