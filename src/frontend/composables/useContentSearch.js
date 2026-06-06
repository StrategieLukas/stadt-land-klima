import lodash from 'lodash'
const { debounce } = lodash

export function useContentSearch() {
  const results = ref([])
  const isLoading = ref(false)

  const _search = debounce(async (q) => {
    if (!q || !q.trim()) {
      results.value = []
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const data = await $fetch(`/api/content-search?q=${encodeURIComponent(q.trim())}`)
      results.value = data?.hits || []
    } catch {
      results.value = []
    } finally {
      isLoading.value = false
    }
  }, 300)

  function search(q) {
    if (q && q.trim()) isLoading.value = true
    _search(q)
  }

  function clear() {
    results.value = []
    isLoading.value = false
    _search.cancel()
  }

  return { results, isLoading, search, clear }
}
