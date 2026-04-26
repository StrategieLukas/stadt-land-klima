import { ref } from 'vue'

// Shared reactive header height in px.
// Set by TheHeaderDesktop via a ResizeObserver; read by TheSearchCommandPalette.
// Initial value matches SSR render exactly to prevent spacer jitter on hydration:
//   Row 1: h-20 (80px) + py-3 (12px × 2 = 24px)          = 104px
//   Nav strip: border-t (1px) + min-h-10 (40px)            =  41px
//   Header border-b                                         =   1px
//   Total                                                   = 146px
const height = ref(146)

// Exact bounding rect of the embedded search input / nav container.
// Set by TheHeaderDesktop; used by TheSearchCommandPalette to align the panel.
const navInputRect = ref({ left: null, width: 576, topInHeader: 0 })

export function useHeaderHeight() {
  return height
}

export function useNavInputRect() {
  return navInputRect
}
