import { computed, onBeforeUnmount, ref, watch } from "vue";
import { OverviewMunicipalitiesSchema, type OverviewMunicipality } from "~/shared/contracts/municipalityOverview";
import { checkedOverviewUrl } from "~/utils/municipalityOverview";

export function useOverviewMunicipalities(
  options: () => {
    collection: string;
    url: string | null;
    snapshot: string;
    bin?: number | undefined;
    query: string;
    enabled: boolean;
  },
) {
  const rows = ref<OverviewMunicipality[]>([]);
  const count = ref(0);
  const cursor = ref<string | null>(null);
  const loading = ref(false);
  const failed = ref(false);
  const stale = ref(false);
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const visited = new Set<string>();
  async function load(more = false) {
    const config = options();
    if (!config.enabled || !config.url || (more && (!cursor.value || loading.value))) return;
    const current = ++generation;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    failed.value = false;
    if (!more) visited.clear();
    try {
      const url = checkedOverviewUrl(config.url, config.collection, "municipalities", config.snapshot);
      const page = OverviewMunicipalitiesSchema.parse(
        await $fetch(url, {
          query: {
            q: config.query.trim() || undefined,
            bin_index: config.bin,
            limit: 50,
            cursor: more ? cursor.value : undefined,
          },
          signal: controller.signal,
          timeout: 10000,
          retry: 0,
        }),
      );
      if (current !== generation) return;
      if (page.snapshot_id !== config.snapshot || (page.next_cursor && visited.has(page.next_cursor)))
        throw new Error("Invalid municipality pagination");
      if (more && page.count !== count.value) throw new Error("Changed municipality count");
      if (!more) visited.clear();
      if (page.next_cursor) visited.add(page.next_cursor);
      const previous = more ? rows.value : [];
      const ars = new Set(previous.map((row) => row.ars));
      for (const row of page.results) {
        if (ars.has(row.ars)) throw new Error("Duplicate municipality");
        ars.add(row.ars);
      }
      const combined = [...previous, ...page.results];
      if (combined.length > page.count) throw new Error("Invalid municipality count");
      rows.value = combined;
      count.value = page.count;
      cursor.value = page.next_cursor;
    } catch (error) {
      if (current !== generation || controller.signal.aborted) return;
      failed.value = true;
      stale.value =
        (error as { statusCode?: number; status?: number }).statusCode === 409 ||
        (error as { status?: number }).status === 409;
      if (!more) rows.value = [];
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  watch(
    options,
    () => {
      ++generation;
      controller?.abort();
      clearTimeout(timer);
      rows.value = [];
      count.value = 0;
      cursor.value = null;
      failed.value = false;
      stale.value = false;
      loading.value = false;
      visited.clear();
      if (import.meta.client && options().enabled) timer = setTimeout(() => void load(), options().query ? 250 : 0);
    },
    { immediate: true, deep: true },
  );
  onBeforeUnmount(() => {
    ++generation;
    controller?.abort();
    clearTimeout(timer);
  });
  return {
    rows,
    count,
    loading,
    failed,
    stale,
    hasMore: computed(() => cursor.value !== null),
    loadMore: () => load(true),
    retry: () => load(),
  };
}
