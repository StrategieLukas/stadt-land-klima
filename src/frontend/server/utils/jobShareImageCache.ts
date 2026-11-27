import { createError } from "h3";

/** Content-addressed, bounded cache. Callers must recheck publication before use. */
export function createJobImageCache() {
  const cache = new Map<string, { png: Buffer; expires: number }>();
  const pending = new Map<string, Promise<Buffer>>();
  let bytes = 0;
  const remove = (key: string) => {
    const old = cache.get(key);
    if (old) bytes -= old.png.length;
    cache.delete(key);
  };
  return async (key: string, render: () => Promise<Buffer>): Promise<Buffer> => {
    const now = Date.now();
    for (const [id, item] of cache) if (item.expires <= now) remove(id);
    const hit = cache.get(key);
    if (hit) return hit.png;
    const current = pending.get(key);
    if (current) return current;
    if (pending.size >= 2) throw createError({ statusCode: 503, statusMessage: "Image renderer busy" });
    const promise = render()
      .then((png) => {
        if (png.length > 4 * 1024 * 1024) throw new Error("Job image exceeds size limit");
        while (cache.size >= 64 || bytes + png.length > 32 * 1024 * 1024) {
          const first = cache.keys().next().value;
          if (first === undefined) break;
          remove(first);
        }
        cache.set(key, { png, expires: Date.now() + 60_000 });
        bytes += png.length;
        return png;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
