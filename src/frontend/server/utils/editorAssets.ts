import { createError } from "h3";
export function validateEditorAssetQuery(query: URLSearchParams) {
  const names = new Set(["width", "height", "quality", "fit", "format", "download", "key"]);
  for (const [name, value] of query) {
    if (!names.has(name) || query.getAll(name).length !== 1) throw createError({ statusCode: 400 });
    if (
      ["width", "height", "quality"].includes(name) &&
      (!/^[1-9]\d{0,3}$/.test(value) || Number(value) > (name === "quality" ? 100 : 4096))
    )
      throw createError({ statusCode: 400 });
    if (name === "fit" && !["cover", "contain", "inside", "outside", "fill"].includes(value))
      throw createError({ statusCode: 400 });
    if (name === "format" && !["png", "jpeg", "jpg", "webp", "avif", "gif", "tiff"].includes(value))
      throw createError({ statusCode: 400 });
    if (name === "key" && !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw createError({ statusCode: 400 });
    if (name === "download" && (value.length > 255 || /[\r\n]/.test(value))) throw createError({ statusCode: 400 });
  }
}
