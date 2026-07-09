"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Clock,
  RefreshCw,
  Shirt,
  Sparkles,
  Upload,
} from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ResultCard } from "@/components/ResultCard";
import { UploadSlot } from "@/components/UploadSlot";
import { WardrobeGrid } from "@/components/WardrobeGrid";
import { useGenerate } from "@/hooks/useGenerate";
import { useWardrobe } from "@/hooks/useWardrobe";
import type { WardrobeItem } from "@/lib/api-types";
import { compressImage } from "@/lib/utils";

type ClothingMode = "upload" | "wardrobe";

export default function Home() {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [clothingImage, setClothingImage] = useState<string | null>(null);
  const [clothingMode, setClothingMode] = useState<ClothingMode>("upload");
  const [selectedWardrobeItem, setSelectedWardrobeItem] =
    useState<WardrobeItem | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const personRef = useRef<HTMLInputElement>(null);
  const clothingRef = useRef<HTMLInputElement>(null);

  const {
    items: wardrobeItems,
    categories,
    loading: wardrobeLoading,
    error: wardrobeError,
  } = useWardrobe();

  const {
    generate,
    loading: generating,
    error: generateError,
    result,
    reset: resetGenerate,
  } = useGenerate();

  const filteredWardrobe = useMemo(() => {
    if (!activeCategory) return wardrobeItems;
    return wardrobeItems.filter((it) => it.category === activeCategory);
  }, [wardrobeItems, activeCategory]);

  const readFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return reject(new Error("读取失败"));
        const compressed = await compressImage(dataUrl, 1024);
        resolve(compressed);
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "person" | "clothing",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Allow re-uploading the same file after a reset.
    e.target.value = "";
    try {
      const dataUrl = await readFile(file);
      if (type === "person") {
        setPersonImage(dataUrl);
      } else {
        setClothingImage(dataUrl);
        setSelectedWardrobeItem(null);
      }
      setReadError(null);
      resetGenerate();
    } catch {
      setReadError("图片读取失败，请重试");
    }
  };

  const handleWardrobeSelect = (item: WardrobeItem) => {
    setSelectedWardrobeItem(item);
    setClothingImage(null);
    resetGenerate();
  };

  const handleGenerate = async () => {
    if (!personImage) return;
    if (clothingMode === "upload") {
      if (!clothingImage) return;
      await generate({ personImage, clothingImage });
    } else {
      if (!selectedWardrobeItem) return;
      await generate({ personImage, clothingId: selectedWardrobeItem.id });
    }
  };

  const handleReset = () => {
    setPersonImage(null);
    setClothingImage(null);
    setSelectedWardrobeItem(null);
    setReadError(null);
    resetGenerate();
  };

  const clothingReady =
    clothingMode === "upload" ? !!clothingImage : !!selectedWardrobeItem;
  const canGenerate = !!personImage && clothingReady && !generating;
  const errorText = readError ?? generateError ?? wardrobeError;

  const missingHint = !personImage
    ? clothingReady
      ? "还差一张人物照"
      : "上传人物照并选择衣服后开始"
    : clothingReady
      ? ""
      : clothingMode === "upload"
        ? "还差一张衣服图"
        : "从衣橱里挑一件吧";

  return (
    <main className="min-h-svh champagne-bg flex items-center justify-center p-4 sm:p-8">
      {/* 9:16 mobile shell */}
      <div className="relative w-full max-w-[420px] sm:aspect-[9/16] bg-[#FAF5EB] sm:rounded-[32px] sm:shadow-2xl overflow-hidden film-grain flex flex-col">
        <div className="relative z-10 flex flex-col h-full overflow-y-auto">
          <header className="px-5 pt-8 pb-4 text-center relative">
            <Link
              href="/history"
              className="absolute top-8 right-5 w-9 h-9 rounded-full bg-[#1E2D24]/8 hover:bg-[#1E2D24]/15 text-[#1E2D24] flex items-center justify-center transition-colors"
              aria-label="生成历史"
            >
              <Clock className="w-4 h-4" />
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E2D24]/8 border border-[#1E2D24]/15 text-[10px] tracking-[0.2em] uppercase text-[#1E2D24]/70 mb-3">
              <Camera className="w-3 h-3" />
              MirrorMag · 换装魔镜
            </div>
            <h1 className="text-[28px] leading-tight text-[#1E2D24] font-semibold">
              换一件
              <span className="text-champagne-gradient font-bold">
                ，换个自己
              </span>
            </h1>
            <p className="mt-2 text-[12px] text-[#5C6B61] leading-relaxed">
              上传一张全身照 · 挑一件衣服 · AI 生成试穿大片
            </p>
          </header>

          <div className="flex-1 px-5 pb-5 flex flex-col gap-4">
            {!result ? (
              <>
                {/* Person + clothing preview row */}
                <div className="grid grid-cols-2 gap-3">
                  <UploadSlot
                    label="人物全身照"
                    icon="🧑"
                    image={personImage}
                    onClick={() => personRef.current?.click()}
                    onClear={() => setPersonImage(null)}
                  />
                  <UploadSlot
                    label="衣服"
                    icon="👗"
                    image={
                      clothingMode === "upload"
                        ? clothingImage
                        : (selectedWardrobeItem?.url ?? null)
                    }
                    onClick={() => {
                      if (clothingMode === "upload")
                        clothingRef.current?.click();
                    }}
                    onClear={() => {
                      setClothingImage(null);
                      setSelectedWardrobeItem(null);
                    }}
                  />
                </div>

                <input
                  ref={personRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "person")}
                />
                <input
                  ref={clothingRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, "clothing")}
                />

                {/* Clothing source toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#1E2D24]/8">
                  <ModeButton
                    active={clothingMode === "upload"}
                    onClick={() => setClothingMode("upload")}
                    icon={<Upload className="w-3.5 h-3.5" />}
                    label="上传衣服"
                  />
                  <ModeButton
                    active={clothingMode === "wardrobe"}
                    onClick={() => setClothingMode("wardrobe")}
                    icon={<Shirt className="w-3.5 h-3.5" />}
                    label="从衣橱选"
                  />
                </div>

                {/* Wardrobe picker */}
                {clothingMode === "wardrobe" && (
                  <div className="flex flex-col gap-2">
                    <CategoryTabs
                      categories={categories}
                      activeId={activeCategory}
                      onSelect={setActiveCategory}
                    />
                    <div className="max-h-64 overflow-y-auto -mx-1 px-1">
                      <WardrobeGrid
                        items={filteredWardrobe}
                        selectedId={selectedWardrobeItem?.id ?? null}
                        onSelect={handleWardrobeSelect}
                        loading={wardrobeLoading}
                      />
                    </div>
                  </div>
                )}

                {errorText && (
                  <div className="rounded-xl bg-[#B22222]/8 border border-[#B22222]/25 px-4 py-3 text-[12px] text-[#B22222] text-center">
                    {errorText}
                  </div>
                )}

                <div className="mt-auto pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={`w-full h-14 rounded-full flex items-center justify-center gap-2 text-[15px] font-medium tracking-wide transition-all duration-300 ${
                      canGenerate
                        ? "bg-[#1E2D24] text-[#FAF5EB] shadow-lg hover:shadow-xl active:scale-[0.98]"
                        : "bg-[#1E2D24]/15 text-[#1E2D24]/40 cursor-not-allowed"
                    }`}
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        AI 冲印中…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        生成试穿大片
                      </>
                    )}
                  </button>
                  {generating && (
                    <p className="text-center mt-3 text-[11px] text-[#5C6B61] animate-pulse">
                      大约需要 20–60 秒，请勿关闭页面
                    </p>
                  )}
                  {!generating && !canGenerate && missingHint && (
                    <p className="text-center mt-3 text-[11px] text-[#5C6B61]/70">
                      {missingHint}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <ResultCard imageUrl={result.outputUrl} onReset={handleReset} />
            )}
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

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full flex items-center justify-center gap-1.5 text-[12px] transition-colors ${
        active
          ? "bg-[#1E2D24] text-[#FAF5EB] shadow-sm"
          : "text-[#1E2D24]/70 hover:text-[#1E2D24]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
