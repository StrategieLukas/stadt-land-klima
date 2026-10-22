import slugify from "slugify";

const slugifyConfig = {
  replacement: "-",
  remove: undefined,
  lower: true,
  strict: true,
  locale: "de",
  trim: true,
};

export function createSlug(value: unknown): string {
  return slugify(typeof value === "string" || typeof value === "number" ? String(value) : "", slugifyConfig);
}
