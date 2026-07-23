import { ref, type Ref } from 'vue';
import type { Page } from './types';

type Api = {
  get: (path: string, config?: Record<string, unknown>) => Promise<{ data?: { data?: unknown } }>;
};

export function usePageSearch(api: Api | undefined) {
  const pageResults: Ref<Page[]> = ref([]);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function search(query: string): void {
    if (timer) clearTimeout(timer);
    if (!query || query.length < 2) {
      pageResults.value = [];
      return;
    }
    timer = setTimeout(async () => {
      try {
        const res = await api?.get('/items/pages', {
          params: {
            'fields[]': ['name', 'slug'],
            filter: JSON.stringify({
              _and: [
                { status: { _eq: 'published' } },
                {
                  _or: [
                    { name: { _icontains: query } },
                    { slug: { _icontains: query } },
                  ],
                },
              ],
            }),
            limit: 6,
          },
        });
        pageResults.value = (res?.data?.data as Page[]) ?? [];
      } catch {
        pageResults.value = [];
      }
    }, 300);
  }

  function selectPage(
    page: Page,
    buffer: { page_slug: string; label: string },
  ): void {
    buffer.page_slug = page.slug;
    if (!buffer.label) buffer.label = page.name;
    pageResults.value = [];
  }

  function clear(): void {
    pageResults.value = [];
  }

  return { pageResults, search, selectPage, clear };
}
