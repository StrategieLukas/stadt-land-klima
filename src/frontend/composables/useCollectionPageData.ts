import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import { CollectionSchema, RenderResponseSchema } from "~/shared/contracts/slz";
import { useCollectionResources } from "~/composables/useCollectionResources";

/** One hydration payload for the bounded metadata/render/summary reads of a product. */
export function useCollectionPageData(
  collection: MaybeRefOrGetter<string>,
  ars: MaybeRefOrGetter<string>,
  eager = true,
) {
  const baseUrl = useRuntimeConfig().public.stadtlandzahlBaseUrl;
  const resources = useCollectionResources(baseUrl);
  const { $locale } = useNuxtApp();
  const language = $locale === "en-GB" ? "en-US" : $locale;
  const key = computed(() => `collection-page:${JSON.stringify([toValue(collection), toValue(ars), language])}`);
  const state = useAsyncData(
    key,
    async (_app, { signal }) => {
      const id = toValue(collection);
      const area = toValue(ars);
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id) || (area && !/^\d{2,12}$/.test(area)))
        throw new Error("Invalid product context");
      const root = `${baseUrl}/api/collections/${id}/`;
      const options = { signal, timeout: 10000, retry: 0 as const };
      const [metadata, render, summary] = await Promise.allSettled([
        area ? resources.metadata(id) : $fetch(root, options).then((value) => CollectionSchema.parse(value)),
        area
          ? $fetch(`${root}render/`, { ...options, query: { area, lang: language } }).then((value) =>
              RenderResponseSchema.parse(value),
            )
          : Promise.resolve(null),
        area ? resources.summary(id, area) : Promise.resolve(null),
      ]);
      if (signal.aborted) throw signal.reason;
      const resolved = metadata.status === "fulfilled" ? metadata.value : null;
      if (resolved && resolved.id !== id) throw new Error("Mismatched product metadata");
      return {
        collectionId: id,
        ars: area,
        collection: resolved,
        render: render.status === "fulfilled" ? render.value : null,
        summary: summary.status === "fulfilled" ? summary.value : null,
      };
    },
    { immediate: eager, server: eager, dedupe: "cancel" },
  );
  watch(
    state.data,
    (data) => {
      if (data?.ars) resources.seed(data.collectionId, data.ars, data.collection, data.summary);
    },
    { immediate: true },
  );
  return state;
}
