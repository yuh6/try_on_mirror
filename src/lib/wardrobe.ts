/**
 * 兼容层 —— 保留原有 import 路径，实际逻辑挪到 src/lib/services/wardrobe.service.ts。
 * 新代码请直接从 `@/lib/services/wardrobe.service` 引入。
 */
export type {
  WardrobeCategory,
  WardrobeItem,
  WardrobeListItem,
  WardrobeTag,
  CreateWardrobeItemParams,
} from "@/lib/services/wardrobe.service";

export {
  listWardrobe,
  getWardrobeItem,
  getWardrobeItemAsDataUri,
  createWardrobeItem,
  deleteWardrobeItem,
  WARDROBE_DIR,
  MAX_UPLOAD_BYTES,
} from "@/lib/services/wardrobe.service";
