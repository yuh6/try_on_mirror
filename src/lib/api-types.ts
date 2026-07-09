// Shared TypeScript types for the frontend API client.
// Mirrors the contract declared in docs/DESIGN.md §3.

export type WardrobeCategory = {
  id: string;
  name: string;
};

export type WardrobeTag = {
  id: string;
  name: string;
};

export type WardrobeItem = {
  id: string;
  name: string;
  category: string;
  file: string;
  url: string;
  tags?: WardrobeTag[];
};

export type WardrobeListResponse = {
  categories: WardrobeCategory[];
  items: WardrobeItem[];
};

export type CreateWardrobeItemRequest = {
  name: string;
  categoryId: string;
  fileBase64: string; // data:image/...;base64,
  tagIds?: string[];
};

export type CreateWardrobeItemResponse = {
  item: WardrobeItem;
};

export type GenerateRequest =
  | {
      personImage: string;
      clothingImage: string;
      clothingId?: undefined;
    }
  | {
      personImage: string;
      clothingImage?: undefined;
      clothingId: string;
    };

export type GenerateResponse = {
  outputUrl: string;
  generationId: string;
};

export type GenerationStatus = "success" | "failed";
export type ClothingSource = "uploaded" | "wardrobe";

export type Generation = {
  id: string;
  createdAt: number;
  clothingSource: ClothingSource;
  clothingRef: string;
  outputUrl: string | null;
  status: GenerationStatus;
  errorMessage: string | null;
  latencyMs: number;
};

export type ListGenerationsQuery = {
  limit?: number;
  cursor?: string;
  status?: GenerationStatus;
};

export type ListGenerationsResponse = {
  items: Generation[];
  nextCursor: string | null;
};

export type OkResponse = { ok: true };

// ---------- 形象分析 ----------

export type AnalysisSkinTone = "warm" | "cool" | "neutral";
export type AnalysisBodyType = "slim" | "medium" | "fuller";

export type AnalysisStructured = {
  skinTone: AnalysisSkinTone;
  bodyType: AnalysisBodyType;
};

export type AnalysisQualitative = {
  compliments: string[];
  suggestion: string;
};

export type AnalyzeRequest = {
  personImage: string; // data:image/...;base64,
};

export type AnalyzeResponse = {
  structured: AnalysisStructured;
  qualitative: AnalysisQualitative;
  fallback: boolean;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
};
