# 衣橱图片目录

把衣服图片文件放在这个目录下(推荐 `.jpg` / `.png`,单边 ≤ 1024px)。
然后在 [src/data/wardrobe.json](../../src/data/wardrobe.json) 添加对应条目:

```json
{
  "id": "w001",
  "name": "白色衬衫",
  "category": "top",
  "file": "w001.jpg"
}
```

- `id` 全局唯一,前端选中后作为 `clothingId` 传给 `/api/generate`
- `category` 必须匹配 `wardrobe.json` 里 `categories[].id` 之一
- `file` 是这个目录下的相对文件名(**不带 `/wardrobe/` 前缀**)

添加完刷新即可,无需重启开发服务器(JSON 每次请求都会重新读取)。
