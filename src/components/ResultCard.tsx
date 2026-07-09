"use client";

import { Download, RefreshCw } from "lucide-react";

export type ResultCardProps = {
  imageUrl: string;
  onReset: () => void;
  onDownload?: () => void;
  downloadFilename?: string;
  className?: string;
};

/**
 * Result preview + reset/download actions. Pure UI.
 * If `onDownload` is omitted, uses the built-in fetch → blob → anchor flow
 * (falls back to opening the URL in a new tab if the fetch is blocked by CORS).
 */
export function ResultCard({
  imageUrl,
  onReset,
  onDownload,
  downloadFilename = "mirrormag-tryon.png",
  className,
}: ResultCardProps) {
  const handleDownload = async () => {
    if (onDownload) return onDownload();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <div className="relative rounded-2xl overflow-hidden bg-[#1E2D24]/5 aspect-[3/4] shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="试穿效果"
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-[#1E2D24]/85 backdrop-blur text-[10px] tracking-wider text-[#FAF5EB] uppercase">
          ✨ AI Generated
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <button
          type="button"
          onClick={onReset}
          className="h-12 rounded-full border border-[#1E2D24]/25 text-[#1E2D24] text-[13px] flex items-center justify-center gap-1.5 hover:bg-[#1E2D24]/5 transition-colors active:scale-[0.98]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          再来一张
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="h-12 rounded-full bg-[#1E2D24] text-[#FAF5EB] text-[13px] flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98]"
        >
          <Download className="w-3.5 h-3.5" />
          保存图片
        </button>
      </div>
    </div>
  );
}

export default ResultCard;
