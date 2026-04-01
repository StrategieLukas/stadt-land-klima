import { ref } from 'vue'

// Shared reactive header height in px.
// Set by TheHeaderDesktop via a ResizeObserver; read by TheSearchCommandPalette.
const height = ref(97)

// Exact bounding rect of the embedded search input / nav container.
// Set by TheHeaderDesktop; used by TheSearchCommandPalette to align the panel.
const navInputRect = ref({ left: null, width: 576, topInHeader: 0 })

export function useHeaderHeight() {
  return height
}

export function useNavInputRect() {
  return navInputRect
}
