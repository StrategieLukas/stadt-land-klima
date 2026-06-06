import { ref } from 'vue'

// Live header height — always reflects the actual offsetHeight of the fixed header
// (including the nav strip when collapsed/expanded). Used by sticky child elements
// (pill nav, sidebar tops) so they follow the header precisely as it animates.
// Initial value matches SSR render exactly to prevent spacer jitter on hydration:
//   Row 1: h-20 (80px) + py-3 (12px × 2 = 24px)          = 104px
//   Nav strip: border-t (1px) + min-h-10 (40px)            =  41px
//   Header border-b                                         =   1px
//   Total                                                   = 146px
const height = ref(146)

// Spacer height — only updated when scrollY < 10.
// The layout spacer (below the fixed header) uses this value instead of `height`.
// Keeping it frozen while scrolled prevents the scroll-anchoring loop:
//   nav strip collapses → spacer shrinks → browser adjusts scrollY → delta triggers
//   nav strip to re-open → loop. The spacer is above the viewport when scrolled so
//   its exact value has no visual effect; stability is all that matters.
const spacerHeight = ref(146)

// Exact bounding rect of the embedded search input / nav container.
// Set by TheHeaderDesktop; used by TheSearchCommandPalette to align the panel.
const navInputRect = ref({ left: null, width: 576, topInHeader: 0 })

export function useHeaderHeight() {
  return height
}

export function useHeaderSpacerHeight() {
  return spacerHeight
}

export function useNavInputRect() {
  return navInputRect
}
