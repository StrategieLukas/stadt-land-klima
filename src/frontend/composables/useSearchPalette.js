import { ref } from 'vue'

const isOpen = ref(false)

export function useSearchPalette() {
  return {
    isOpen,
    open() { isOpen.value = true },
    close() { isOpen.value = false },
    toggle() { isOpen.value = !isOpen.value },
  }
}
