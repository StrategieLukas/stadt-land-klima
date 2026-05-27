import slugify from "slugify";

const slugifyConfig = {
  replacement: "-",
  remove: undefined,
  lower: true,
  strict: true,
  locale: "de",
  trim: true,
} as const;

export default {
  id: "operation-slugify",
  handler: ({ text }: { text: string }) => ({
    text: slugify(text, slugifyConfig),
  }),
};
