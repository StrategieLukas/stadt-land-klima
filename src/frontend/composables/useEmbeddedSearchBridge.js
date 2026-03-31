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

// Tab meta is shared so the embedded input can show the right placeholder.
const tabs = {
  municipalities: { placeholder: 'Gemeinde oder Landkreis suchen…' },
  pages:          { placeholder: 'Seiteninhalt durchsuchen…' },
  events:         { placeholder: 'Veranstaltungen suchen…' },
  concepts:       { placeholder: 'Maßnahmen und Themen suchen…' },
  content:        { placeholder: 'Seiten, Blöcke, Veranstaltungen…' },
}
const activeTab = ref('municipalities')

export function useEmbeddedSearchBridge() {
  return {
    tabs,
    activeTab,
    /** Called by TheSearchCommandPalette to register its functions */
    register(moveFn, navigateFn, activeTabRef) {
      _moveFocus.value = moveFn
      _navigateFocused.value = navigateFn
      // keep activeTab in sync with palette's own activeTab
      if (activeTabRef) {
        activeTab.value = activeTabRef.value
      }
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
