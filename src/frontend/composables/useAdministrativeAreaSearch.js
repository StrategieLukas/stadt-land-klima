import { ref } from 'vue'
import { useAreaSearch } from '~/composables/useAreaSearch.js'

/**
 * Backward-compatible shim — thin wrapper around useAreaSearch({ mode: 'reasonable' }).
 * Preserves the `query` ref that some callers use for v-model.
 */
export function useAdministrativeAreaSearch() {
  const { results, isLoading, search: _search, clear: _clear } = useAreaSearch({ mode: 'reasonable' })

  const query = ref('')

  function search(term) {
    query.value = term
    if (term.trim()) _search(term)
    else _clear()
  }

  function clear() {
    query.value = ''
    _clear()
  }

  return { query, results, isLoading, search, clear }
}

