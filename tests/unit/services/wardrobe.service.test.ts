import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../../helpers/db";
import {
  seedCategories,
  seedTags,
  seedWardrobeItem,
  TINY_PNG_BASE64,
  TINY_PNG_DATA_URI,
  TINY_JPEG_DATA_URI,
  TINY_WEBP_DATA_URI,
} from "../../helpers/fixtures";
import {
  listWardrobe,
  getWardrobeItem,
  getWardrobeItemAsDataUri,
  createWardrobeItem,
  deleteWardrobeItem,
  WARDROBE_DIR,
  MAX_UPLOAD_BYTES,
} from "@/lib/services/wardrobe.service";
import { AppError } from "@/lib/errors";
import { wardrobeItems, wardrobeItemTags } from "@/db/schema";

// 每个用例前 seed 分类/标签
beforeEach(() => {
  seedCategories();
  seedTags();
});

describe("wardrobe.service · listWardrobe", () => {
  it("空表返回 categories 与空 items", async () => {
    const result = await listWardrobe();
    expect(result.items).toEqual([]);
    // 分类按 sortOrder 升序
    expect(result.categories.map((c) => c.id)).toEqual(["top", "dress", "bottom"]);
  });

  it("列出全部单品并组装 url", async () => {
    seedWardrobeItem({ id: "w001", name: "白衬衫", categoryId: "top", file: "w001.png" });
    seedWardrobeItem({ id: "w002", name: "长裙", categoryId: "dress", file: "w002.png" });
    const result = await listWardrobe();
    expect(result.items).toHaveLength(2);
    const w001 = result.items.find((i) => i.id === "w001");
    expect(w001).toMatchObject({
      id: "w001",
      name: "白衬衫",
      category: "top",
      file: "w001.png",
      url: "/wardrobe/w001.png",
    });
    // 未关联 tag → tags 字段不出现
    expect(w001?.tags).toBeUndefined();
  });

  it("按 category 过滤只返回对应分类的单品", async () => {
    seedWardrobeItem({ id: "w001", name: "白衬衫", categoryId: "top", file: "w001.png" });
    seedWardrobeItem({ id: "w002", name: "长裙", categoryId: "dress", file: "w002.png" });
    seedWardrobeItem({ id: "w003", name: "T恤", categoryId: "top", file: "w003.png" });
    const result = await listWardrobe({ category: "top" });
    expect(result.items.map((i) => i.id).sort()).toEqual(["w001", "w003"]);
  });

  it("关联的 tags 会一同返回", async () => {
    seedWardrobeItem({
      id: "w001",
      name: "白衬衫",
      categoryId: "top",
      file: "w001.png",
      tagIds: ["tag_slim", "tag_work"],
    });
    const result = await listWardrobe();
    const item = result.items[0];
    expect(item.tags).toBeDefined();
    expect(item.tags!.map((t) => t.id).sort()).toEqual(["tag_slim", "tag_work"]);
  });
});

describe("wardrobe.service · getWardrobeItem", () => {
  it("命中返回行", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const row = await getWardrobeItem("w001");
    expect(row?.id).toBe("w001");
  });

  it("不存在返回 null", async () => {
    expect(await getWardrobeItem("nope")).toBeNull();
  });
});

describe("wardrobe.service · createWardrobeItem", () => {
  it("成功写入并落盘，返回带 url 的项", async () => {
    const item = await createWardrobeItem({
      name: "新单品",
      categoryId: "top",
      fileBase64: TINY_PNG_DATA_URI,
    });
    expect(item.id.startsWith("wu_")).toBe(true);
    expect(item.name).toBe("新单品");
    expect(item.category).toBe("top");
    expect(item.file.endsWith(".png")).toBe(true);
    expect(item.url).toBe(`/wardrobe/${item.file}`);
    // DB 中确实有一行
    expect(await getWardrobeItem(item.id)).not.toBeNull();
    // 文件确实写到了 WARDROBE_DIR
    const filePath = path.join(WARDROBE_DIR, item.file);
    expect(existsSync(filePath)).toBe(true);
    const buf = await readFile(filePath);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("name 去空后为空 → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "   ",
        categoryId: "top",
        fileBase64: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("name 超过 64 字符 → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "n".repeat(65),
        categoryId: "top",
        fileBase64: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("categoryId 不存在 → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "x",
        categoryId: "ghost_cat",
        fileBase64: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("tagIds 里包含未注册的 tag → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "x",
        categoryId: "top",
        fileBase64: TINY_PNG_DATA_URI,
        tagIds: ["tag_slim", "ghost_tag"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("tagIds 全部合法 → 落库并可回读", async () => {
    const item = await createWardrobeItem({
      name: "带标签的",
      categoryId: "top",
      fileBase64: TINY_PNG_DATA_URI,
      tagIds: ["tag_slim", "tag_work"],
    });
    expect(item.tags?.map((t) => t.id).sort()).toEqual(["tag_slim", "tag_work"]);
  });

  it("data URI 非法 → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "x",
        categoryId: "top",
        fileBase64: "not-a-data-uri",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("MIME 非白名单（image/gif）→ BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "x",
        categoryId: "top",
        fileBase64: `data:image/gif;base64,${TINY_PNG_BASE64}`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("base64 解码后为空 → BAD_REQUEST", async () => {
    await expect(
      createWardrobeItem({
        name: "x",
        categoryId: "top",
        fileBase64: "data:image/png;base64,",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("解码后超过 5MB → PAYLOAD_TOO_LARGE", async () => {
    // 构造 5MB+1 字节，base64 编码后放入 data URI
    const bytes = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff);
    const dataUri = `data:image/png;base64,${bytes.toString("base64")}`;
    await expect(
      createWardrobeItem({ name: "big", categoryId: "top", fileBase64: dataUri })
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("接受 jpeg / webp MIME", async () => {
    const a = await createWardrobeItem({
      name: "a",
      categoryId: "top",
      fileBase64: TINY_JPEG_DATA_URI,
    });
    expect(a.file.endsWith(".jpg")).toBe(true);
    const b = await createWardrobeItem({
      name: "b",
      categoryId: "top",
      fileBase64: TINY_WEBP_DATA_URI,
    });
    expect(b.file.endsWith(".webp")).toBe(true);
  });

  it("事务失败时回滚已落盘文件", async () => {
    // 让 db.transaction 抛错 —— 触发 catch 分支的 unlink
    const txSpy = vi
      .spyOn(db, "transaction")
      .mockRejectedValueOnce(new Error("模拟事务失败"));

    // 记录 WARDROBE_DIR 里事务前的文件数
    const { readdirSync } = await import("node:fs");
    const before = readdirSync(WARDROBE_DIR);

    await expect(
      createWardrobeItem({
        name: "回滚测试",
        categoryId: "top",
        fileBase64: TINY_PNG_DATA_URI,
      })
    ).rejects.toMatchObject({ code: "INTERNAL" });

    // 事务失败后 WARDROBE_DIR 里不应遗留新文件
    const after = readdirSync(WARDROBE_DIR);
    expect(after.length).toBe(before.length);

    txSpy.mockRestore();
  });
});

describe("wardrobe.service · deleteWardrobeItem", () => {
  it("同步删 DB 行与磁盘文件", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const filePath = path.join(WARDROBE_DIR, "w001.png");
    expect(existsSync(filePath)).toBe(true);
    await deleteWardrobeItem("w001");
    expect(await getWardrobeItem("w001")).toBeNull();
    expect(existsSync(filePath)).toBe(false);
  });

  it("id 不存在 → NOT_FOUND", async () => {
    await expect(deleteWardrobeItem("ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("磁盘文件已缺失也视为幂等成功", async () => {
    // 先 seed 行，但手动删掉磁盘文件（模拟 ENOENT）
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const filePath = path.join(WARDROBE_DIR, "w001.png");
    const fs = await import("node:fs/promises");
    await fs.unlink(filePath);
    // 再删应不抛
    await expect(deleteWardrobeItem("w001")).resolves.toBeUndefined();
    expect(await getWardrobeItem("w001")).toBeNull();
  });

  it("级联删除单品标签关联行", async () => {
    seedWardrobeItem({
      id: "w001",
      name: "衫",
      categoryId: "top",
      file: "w001.png",
      tagIds: ["tag_slim"],
    });
    await deleteWardrobeItem("w001");
    // 关联表因 ON DELETE CASCADE 应为空
    const remaining = await db.select().from(wardrobeItemTags).all();
    expect(remaining).toEqual([]);
  });

  it("file 字段含路径分隔符 → INTERNAL 拒绝", async () => {
    // 手工写入非法 file 值绕过 create 校验
    await db.insert(wardrobeItems).values({
      id: "w_evil",
      name: "恶意",
      categoryId: "top",
      file: "../etc/passwd",
      createdAt: new Date(),
    });
    await expect(deleteWardrobeItem("w_evil")).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

describe("wardrobe.service · getWardrobeItemAsDataUri", () => {
  it("成功返回 data:image/png;base64,... ", async () => {
    seedWardrobeItem({ id: "w001", name: "衫", categoryId: "top", file: "w001.png" });
    const dataUri = await getWardrobeItemAsDataUri("w001");
    expect(dataUri.startsWith("data:image/png;base64,")).toBe(true);
    // base64 内容非空
    const b64 = dataUri.split(",")[1];
    expect(b64.length).toBeGreaterThan(0);
  });

  it("id 不存在 → NOT_FOUND", async () => {
    await expect(getWardrobeItemAsDataUri("ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("file 字段含路径穿越（../）→ INTERNAL 拒绝", async () => {
    await db.insert(wardrobeItems).values({
      id: "w_evil",
      name: "恶意",
      categoryId: "top",
      file: "../../etc/passwd",
      createdAt: new Date(),
    });
    await expect(getWardrobeItemAsDataUri("w_evil")).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("file 字段含反斜杠路径 → INTERNAL 拒绝", async () => {
    await db.insert(wardrobeItems).values({
      id: "w_evil2",
      name: "恶意",
      categoryId: "top",
      file: "sub\\evil.png",
      createdAt: new Date(),
    });
    // Windows 上 path.basename 会把反斜杠视作分隔符
    await expect(getWardrobeItemAsDataUri("w_evil2")).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("扩展名不在白名单 → INTERNAL 拒绝", async () => {
    // 先真实落盘一个 .txt 文件避免 readFile 抛 ENOENT
    await mkdir(WARDROBE_DIR, { recursive: true });
    await writeFile(path.join(WARDROBE_DIR, "w_bad.txt"), Buffer.from("hi"));
    await db.insert(wardrobeItems).values({
      id: "w_bad_ext",
      name: "怪扩展",
      categoryId: "top",
      file: "w_bad.txt",
      createdAt: new Date(),
    });
    await expect(getWardrobeItemAsDataUri("w_bad_ext")).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

// 冗余引用避免 TS 未使用告警（AppError 类型断言用途）
void AppError;
