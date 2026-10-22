import { ContentResponseSchema, type ContentHit } from "~/shared/contracts/search";
import lodash from "lodash";
const debounce = lodash.debounce.bind(lodash);

export function useContentSearch() {
  const results = ref<ContentHit[]>([]);
  const isLoading = ref(false);
  let searchGeneration = 0;

  const _search = debounce(async (q: string, generation: number) => {
    if (generation !== searchGeneration) return;
    if (!q || !q.trim()) {
      results.value = [];
      isLoading.value = false;
      return;
    }
    isLoading.value = true;
    try {
      const data = await $fetch(`/api/content-search?q=${encodeURIComponent(q.trim())}`);
      if (generation !== searchGeneration) return;
      results.value = ContentResponseSchema.parse(data).hits;
    } catch {
      if (generation !== searchGeneration) return;
      results.value = [];
    } finally {
      if (generation === searchGeneration) isLoading.value = false;
    }
  }, 300);

  function search(q: string) {
    const generation = ++searchGeneration;
    if (q && q.trim()) isLoading.value = true;
    void _search(q, generation);
  }

  function clear() {
    searchGeneration++;
    results.value = [];
    isLoading.value = false;
    _search.cancel();
  }

  return { results, isLoading, search, clear };
}
