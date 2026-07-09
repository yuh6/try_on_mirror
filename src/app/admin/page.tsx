"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Upload, ImagePlus, RefreshCw } from "lucide-react";
import { CategoryTabs } from "@/components/CategoryTabs";
import { useWardrobe } from "@/hooks/useWardrobe";
import { compressImage } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";
import type { WardrobeItem } from "@/lib/api-types";

export default function AdminPage() {
  const {
    items,
    categories,
    loading,
    error: listError,
    refetch,
    addItem,
    removeItem,
  } = useWardrobe();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveCategoryId = categoryId || categories[0]?.id || "";

  const filtered = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter((it) => it.category === activeCategory);
  }, [items, activeCategory]);

  const resetForm = () => {
    setName("");
    setPendingImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setFormError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (ev) => {
          const v = ev.target?.result;
          if (typeof v === "string") resolve(v);
          else reject(new Error("读取失败"));
        };
        r.onerror = () => reject(new Error("文件读取失败"));
        r.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 1024);
      setPendingImage(compressed);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      setFormError("图片读取失败，请重试");
    }
  };

  const handleUpload = async () => {
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("请填写名称");
      return;
    }
    if (!effectiveCategoryId) {
      setFormError("请选择分类");
      return;
    }
    if (!pendingImage) {
      setFormError("请选择图片");
      return;
    }
    setUploading(true);
    try {
      await addItem({
        name: trimmed,
        categoryId: effectiveCategoryId,
        fileBase64: pendingImage,
      });
      resetForm();
      setFlash("上传成功");
      window.setTimeout(() => setFlash(null), 2000);
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else if (err instanceof Error) setFormError(err.message);
      else setFormError("上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: WardrobeItem) => {
    if (!window.confirm(`确定删除「${item.name}」？此操作不可撤销。`)) return;
    setDeletingId(item.id);
    try {
      await removeItem(item.id);
      setFlash("已删除");
      window.setTimeout(() => setFlash(null), 2000);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "删除失败";
      setFormError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-svh champagne-bg p-4 sm:p-8">
      <div className="mx-auto w-full max-w-[960px] flex flex-col gap-6">
        <header className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-[#1E2D24]/8 hover:bg-[#1E2D24]/15 text-[#1E2D24] flex items-center justify-center transition-colors"
            aria-label="返回首页"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <h1 className="text-[22px] leading-tight text-[#1E2D24] font-semibold">
              衣橱管理
            </h1>
            <p className="text-[12px] text-[#5C6B61]">
              上传新衣物 · 删除数据库中的图片
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="h-9 px-3 rounded-full bg-[#1E2D24]/8 hover:bg-[#1E2D24]/15 text-[#1E2D24] flex items-center gap-1.5 text-[12px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </header>

        {/* 上传卡片 */}
        <section className="rounded-2xl bg-[#FAF5EB] border border-[#D4C4A0]/60 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-[14px] font-medium text-[#1E2D24] flex items-center gap-1.5">
            <ImagePlus className="w-4 h-4" />
            新增衣物
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[160px,1fr] gap-4">
            {/* 图片选择 */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="aspect-[3/4] rounded-xl border border-dashed border-[#C5A880] bg-[#1E2D24]/[0.03] hover:bg-[#1E2D24]/[0.06] transition-colors overflow-hidden flex items-center justify-center text-[#5C6B61] text-[12px]"
            >
              {pendingImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingImage}
                  alt="待上传"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-5 h-5" />
                  <span>点击选择图片</span>
                  <span className="text-[10px] text-[#5C6B61]/70">
                    ≤ 5MB · jpg/png/webp
                  </span>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
            />

            {/* 表单字段 */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] text-[#5C6B61] mb-1">
                  名称
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                  placeholder="例如：奶油白衬衫"
                  className="w-full h-10 px-3 rounded-lg bg-white border border-[#D4C4A0] focus:border-[#1E2D24] outline-none text-[13px] text-[#1E2D24]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#5C6B61] mb-1">
                  分类
                </label>
                <select
                  value={effectiveCategoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white border border-[#D4C4A0] focus:border-[#1E2D24] outline-none text-[13px] text-[#1E2D24]"
                >
                  {categories.length === 0 && (
                    <option value="">（暂无分类）</option>
                  )}
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="rounded-lg bg-[#B22222]/8 border border-[#B22222]/25 px-3 py-2 text-[12px] text-[#B22222]">
                  {formError}
                </div>
              )}
              {flash && (
                <div className="rounded-lg bg-[#1E2D24]/8 border border-[#1E2D24]/20 px-3 py-2 text-[12px] text-[#1E2D24]">
                  {flash}
                </div>
              )}

              <div className="flex gap-2 mt-auto">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !pendingImage || !name.trim()}
                  className={`flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-[13px] font-medium transition-all ${
                    uploading || !pendingImage || !name.trim()
                      ? "bg-[#1E2D24]/15 text-[#1E2D24]/40 cursor-not-allowed"
                      : "bg-[#1E2D24] text-[#FAF5EB] shadow hover:shadow-lg active:scale-[0.98]"
                  }`}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      上传中…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      上传
                    </>
                  )}
                </button>
                {(pendingImage || name) && !uploading && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-11 px-4 rounded-full bg-[#1E2D24]/8 hover:bg-[#1E2D24]/15 text-[#1E2D24] text-[13px]"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 列表 */}
        <section className="rounded-2xl bg-[#FAF5EB] border border-[#D4C4A0]/60 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-[#1E2D24]">
              衣橱列表{" "}
              <span className="text-[12px] text-[#5C6B61]/70 ml-1">
                共 {items.length} 件
              </span>
            </h2>
          </div>

          <CategoryTabs
            categories={categories}
            activeId={activeCategory}
            onSelect={setActiveCategory}
          />

          {listError && (
            <div className="rounded-lg bg-[#B22222]/8 border border-[#B22222]/25 px-3 py-2 text-[12px] text-[#B22222]">
              {listError}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-xl skeleton-shimmer"
                  aria-hidden
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[12px] text-[#5C6B61]/70">
              {items.length === 0 ? "还没有任何衣物" : "这个分类为空"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((item) => {
                const cat = categories.find((c) => c.id === item.category);
                const isDeleting = deletingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[#D4C4A0] bg-white group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-[#1E2D24]/85 to-transparent">
                      <div className="text-[11px] text-[#FAF5EB] truncate">
                        {item.name}
                      </div>
                      <div className="text-[9px] text-[#FAF5EB]/70 truncate">
                        {cat?.name ?? item.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={isDeleting}
                      className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                        isDeleting
                          ? "bg-[#B22222]/60 text-white"
                          : "bg-[#1E2D24]/70 text-white hover:bg-[#B22222] opacity-0 group-hover:opacity-100 focus:opacity-100"
                      }`}
                      aria-label={`删除 ${item.name}`}
                      title="删除"
                    >
                      {isDeleting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
