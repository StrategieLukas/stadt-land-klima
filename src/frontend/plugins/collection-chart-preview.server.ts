import { collectionChartPreviewUrl, renderCollectionChartPreview } from "~/server/utils/collectionChartPreview";
import { emptyCollectionChartPreview, type CollectionChartPreview } from "~/utils/collectionChartTheme";

export default defineNuxtPlugin(() => {
  const requestFetch = useRequestFetch();
  // Request-scoped only: no cross-session HTML/data cache or stale publication responses.
  const feeds = new Map<string, Promise<string>>();
  let bytes = 0;
  let chartCount = 0;
  let deadline = 0;
  async function load(value: string): Promise<string> {
    const url = collectionChartPreviewUrl(value);
    const cached = feeds.get(url);
    if (cached) return cached;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Chart preview deadline exceeded");
    if (feeds.size >= 24) throw new Error("Chart preview feed limit exceeded");
    const pending = requestFetch<string>(url, { responseType: "text", timeout: remaining, retry: 0 }).then((body) => {
      const size = Buffer.byteLength(body);
      if (size > 1024 * 1024 || bytes + size > 4 * 1024 * 1024) throw new Error("Chart preview data limit exceeded");
      JSON.parse(body);
      bytes += size;
      return body;
    });
    feeds.set(url, pending);
    return pending;
  }
  return {
    provide: {
      async collectionChartPreview(spec: unknown, height: number): Promise<CollectionChartPreview> {
        if (++chartCount > 8) return emptyCollectionChartPreview();
        if (!deadline) deadline = Date.now() + 3000;
        try {
          return await renderCollectionChartPreview(spec, height, `slk-preview-${chartCount}-`, load);
        } catch {
          // Unsupported or unavailable feeds retain the normal browser renderer.
          return emptyCollectionChartPreview();
        }
      },
    },
  };
});
