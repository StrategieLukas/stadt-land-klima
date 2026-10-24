import { z } from "zod";
import type { NavigationItem } from "~/types/components/navigation";

export const NavigationItemSchema: z.ZodType<NavigationItem> = z.object({
  id: z.union([z.string(), z.number()]),
  label: z.string().nullish(),
  name: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  translation_key: z.string().nullish(),
  link_type: z.enum(["page", "external", "none"]).optional(),
  page_slug: z.string().nullish(),
  slug: z.string().nullish(),
  external_url: z.string().nullish(),
  open_new_tab: z.boolean().optional(),
  image_id: z.string().nullish(),
  icon: z.string().nullish(),
  links: z.lazy(() => z.array(NavigationItemSchema)).optional(),
  children: z.lazy(() => z.array(NavigationItemSchema)).nullish(),
});
export const SiteLayoutSchema = z.object({
  pages: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      contents: z.string().nullable(),
      sort_order: z.number().nullable(),
      menus: z.array(z.string()).optional(),
    }),
  ),
  municipalities: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
  navigationConfig: z
    .object({
      header_items: z.array(NavigationItemSchema).nullish(),
      footer_columns: z.array(NavigationItemSchema).nullish(),
    })
    .nullable(),
});
