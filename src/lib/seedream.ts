const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_API_BASE =
  process.env.ARK_API_BASE || "https://ark.cn-beijing.volces.com/api/v3";

interface SeedreamResponse {
  model: string;
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    size?: string;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

// 调用 Seedream 5.0 生成图片
export async function generateImage(params: {
  prompt: string;
  images: string[]; // 参考图 URL 或 base64 data URI 数组
  size?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const body = {
    model: "doubao-seedream-5-0-pro-260628",
    prompt: params.prompt,
    image: params.images,
    size: params.size || "2K",
    response_format: "url",
    watermark: false,
  };

  const res = await fetch(`${ARK_API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const data: SeedreamResponse = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `请求失败 (${res.status})`);
  }

  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("未返回图片 URL");
  }

  return imageUrl;
}
