/**
 * Bridges the embedded search input in TheHeaderDesktop with the keyboard
 * navigation logic that lives in TheSearchCommandPalette.
 *
 * The palette registers its moveFocus / navigateToFocused functions here;
 * the header calls them via moveFocusEmbedded / navigateFocusedEmbedded.
 */
import { ref } from 'vue'

const _moveFocus = ref(null)
const _navigateFocused = ref(null)

const placeholder = 'Gemeinde oder Inhalt suchen…'

export function useEmbeddedSearchBridge() {
  return {
    placeholder,
    /** Called by TheSearchCommandPalette to register its functions */
    register(moveFn, navigateFn) {
      _moveFocus.value = moveFn
      _navigateFocused.value = navigateFn
    },
    /** Called by TheHeaderDesktop keyboard handler */
    moveFocusEmbedded(dir) {
      _moveFocus.value?.(dir)
    },
    navigateFocusedEmbedded() {
      _navigateFocused.value?.()
    },
  }
}
