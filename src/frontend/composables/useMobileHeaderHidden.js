import { ref } from 'vue'

// Shared reactive state: true when the mobile header has slid off-screen.
// Written by TheHeaderMobile; read by pages that need to offset sticky elements.
const hidden = ref(false)

export function useMobileHeaderHidden() {
  return hidden
}
