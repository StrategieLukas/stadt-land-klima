import { onMounted, watch } from 'vue'
import { useRoute } from '#imports'

export function useBlockHashNavigation() {
  const route = useRoute()

  function scrollToHash(hash) {
    if (!hash || !hash.startsWith('#')) return

    let id
    try {
      id = decodeURIComponent(hash.slice(1))
    } catch {
      id = hash.slice(1)
    }

    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el.matches('[class*="blokkli-block-"]')) {
      el.classList.add('block-anchor-highlight')
      setTimeout(() => el.classList.remove('block-anchor-highlight'), 2000)
    }
  }

  onMounted(() => {
    if (route.hash) {
      // Small delay to ensure blocks are rendered after SSR hydration
      setTimeout(() => scrollToHash(route.hash), 150)
    }
  })

  watch(() => route.hash, (hash) => scrollToHash(hash))
}
