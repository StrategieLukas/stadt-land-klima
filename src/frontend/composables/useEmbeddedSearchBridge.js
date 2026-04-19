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
const _focusInput = ref(null)

const placeholder = 'Gemeinde, Projekt oder Thema suchen…'

export function useEmbeddedSearchBridge() {
  return {
    placeholder,
    /** Called by TheSearchCommandPalette to register its functions */
    register(moveFn, navigateFn) {
      _moveFocus.value = moveFn
      _navigateFocused.value = navigateFn
    },
    /** Called by TheHeaderDesktop to register the focus-input callback */
    registerFocusInput(fn) {
      _focusInput.value = fn
    },
    /** Called by TheHeaderDesktop keyboard handler */
    moveFocusEmbedded(dir) {
      _moveFocus.value?.(dir)
    },
    navigateFocusedEmbedded() {
      _navigateFocused.value?.()
    },
    /** Focus the embedded search input in the header (used by Ctrl+K) */
    focusHeaderInput() {
      _focusInput.value?.()
    },
    /** True when the header input is registered */
    get hasHeaderInput() {
      return !!_focusInput.value
    },
  }
}
