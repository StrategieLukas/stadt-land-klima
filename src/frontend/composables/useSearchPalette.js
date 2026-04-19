import { ref } from 'vue'

const isOpen = ref(false)
const query = ref('')
const embeddedInput = ref(false)

export function useSearchPalette() {
  return {
    isOpen,
    query,
    embeddedInput,
    open() {
      query.value = ''
      embeddedInput.value = false
      isOpen.value = true
    },
    openEmbedded() {
      query.value = ''
      embeddedInput.value = true
      isOpen.value = true
    },
    close() {
      isOpen.value = false
      embeddedInput.value = false
      query.value = ''
    },
    toggle() { isOpen.value = !isOpen.value },
  }
}
