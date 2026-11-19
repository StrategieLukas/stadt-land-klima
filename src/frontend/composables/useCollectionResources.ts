import { inject, onScopeDispose, provide, type InjectionKey } from "vue";
import { CollectionSchema, SummarySchema } from "~/shared/contracts/slz";
import type { Collection, CollectionSummary } from "~/types/slz-api";

const resourcesKey: InjectionKey<ReturnType<typeof createCollectionResources>> = Symbol("collection-resources");

/** Share checked reads only within this page; never cache observations across visitors or navigation. */
function createCollectionResources(baseUrl: string) {
  const metadata = new Map<string, Promise<Collection>>();
  const summaries = new Map<string, Promise<CollectionSummary>>();
  const controller = new AbortController();
  const waiting: (() => void)[] = [];
  let active = 0;
  onScopeDispose(() => controller.abort());

  async function read<T>(cache: Map<string, Promise<T>>, key: string, request: () => Promise<T>): Promise<T> {
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = (async () => {
      if (active < 6) active++;
      else await new Promise<void>((resolve) => waiting.push(resolve));
      try {
        controller.signal.throwIfAborted();
        return await request();
      } finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    })();
    cache.set(key, pending);
    try {
      return await pending;
    } catch (failure) {
      cache.delete(key);
      throw failure;
    }
  }

  function root(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw new Error("Invalid product context");
    return `${baseUrl}/api/collections/${id}/`;
  }
  const options = { signal: controller.signal, timeout: 10000, retry: 0 as const };
  return {
    async metadata(id: string) {
      const url = root(id);
      return read(metadata, id, async () => {
        const value = CollectionSchema.parse(await $fetch(url, { ...options, query: { metadata_only: "true" } }));
        if (value.id !== id) throw new Error("Mismatched product metadata");
        return value;
      });
    },
    async summary(id: string, ars: string) {
      const url = root(id);
      if (!/^\d{2,12}$/.test(ars)) throw new Error("Invalid product area");
      return read(summaries, JSON.stringify([id, ars]), async () => {
        const value = SummarySchema.parse(await $fetch(`${url}summary/`, { ...options, query: { area: ars } }));
        if (value.area_ars !== undefined && value.area_ars !== ars) throw new Error("Mismatched product area");
        return value;
      });
    },
    seed(id: string, ars: string, collection: Collection | null, summary: CollectionSummary | null) {
      if (collection?.id === id && !metadata.has(id)) metadata.set(id, Promise.resolve(collection));
      const key = JSON.stringify([id, ars]);
      if (summary && !summaries.has(key)) summaries.set(key, Promise.resolve(summary));
    },
  };
}

export function provideCollectionResources(baseUrl: string) {
  provide(resourcesKey, createCollectionResources(baseUrl));
}

export function useCollectionResources(baseUrl: string) {
  return inject(resourcesKey, null) ?? createCollectionResources(baseUrl);
}
