import { z } from "zod";
import { tourHref } from "~/shared/successProjectTour";
export async function useLegacyTourRedirect(kind: "tour" | "stop", slug: string): Promise<boolean> {
  const route = useRoute();
  try {
    const result = z
      .object({
        found: z.boolean(),
        data: z.object({ slug: z.string(), tour: z.object({ slug: z.string() }).optional() }),
      })
      .parse(await $fetch("/api/public/legacy-tour-redirect", { query: { kind, slug } }));
    if (!result.found) return false;
    const row = result.data;
    if (kind === "stop" && !row.tour) return false;
    const href = kind === "tour" ? tourHref(row) : `/projects/tours/${row.tour!.slug}/${row.slug}`;
    await navigateTo(href + route.fullPath.slice(route.path.length), { redirectCode: 301, replace: true });
    return true;
  } catch {
    return false;
  }
}
