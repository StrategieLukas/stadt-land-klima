import { ref } from 'vue'
import lodash from 'lodash'
const { debounce } = lodash

/**
 * Composable for searching administrative areas via the stadtlandzahl GraphQL API.
 * Mirrors the logic in AdministrativeAreaSearchBar.vue but exposes
 * results/loading/query as reactive refs so they can be used in any context.
 */
export function useAdministrativeAreaSearch() {
  const { $stadtlandzahlAPI } = useNuxtApp()

  const query = ref('')
  const results = ref([])
  const isLoading = ref(false)

  const _search = debounce(async (term) => {
    if (!term.trim()) {
      results.value = []
      isLoading.value = false
      return
    }
    isLoading.value = true
    try {
      const data = await $stadtlandzahlAPI.searchThroughAdministrativeAreasByName(
        term.trim(),
        { isReasonableForMunicipalRating: true }
      )
      if (data?.allAdministrativeAreas?.edges) {
        results.value = data.allAdministrativeAreas.edges.map(e => e.node)
      } else {
        results.value = []
      }
    } catch {
      results.value = []
    } finally {
      isLoading.value = false
    }
  }, 300)

  function search(term) {
    query.value = term
    if (term.trim()) isLoading.value = true
    _search(term)
  }

  function clear() {
    query.value = ''
    results.value = []
    isLoading.value = false
    _search.cancel()
  }

  return { query, results, isLoading, search, clear }
}
