import { z } from "zod";
import { AreaSchema } from "~/shared/contracts/search";
const ManifestSchema = z.object({ byState: z.record(z.string(), z.array(AreaSchema)) });
type Manifest = z.infer<typeof ManifestSchema>;
const cache = new Map<string, { promise: Promise<Manifest | null>; retryAfter: number; value: Manifest | null }>();
export async function fetchMunicipalitiesManifest(baseUrl: string): Promise<Manifest | null> {
  const previous = cache.get(baseUrl);
  if (previous?.value) return previous.value;
  if (previous && Date.now() < previous.retryAfter) return null;
  if (previous?.retryAfter === 0) return previous.promise;
  const entry = {
    value: null as Manifest | null,
    retryAfter: 0,
    promise: Promise.resolve(null) as Promise<Manifest | null>,
  };
  entry.promise = $fetch<unknown>(`${baseUrl}/api/manifests/municipalities-by-state`)
    .then((value) => {
      entry.value = ManifestSchema.parse(value);
      return entry.value;
    })
    .catch(() => {
      entry.retryAfter = Date.now() + 5000;
      return null;
    });
  cache.set(baseUrl, entry);
  return entry.promise;
}
export function clearMunicipalitiesManifestCache() {
  cache.clear();
}
