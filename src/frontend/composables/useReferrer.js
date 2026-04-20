import { computed, isRef } from 'vue'

/**
 * Returns a reactive back-link href and label.
 *
 * If the user navigated from another page within the app, the referrer route is
 * used as the href. The label falls back to a generic "Zurück" in that case so
 * destination-specific labels (e.g. "Alle Veranstaltungen") only show when the
 * user actually came from that destination.
 *
 * On direct URL load / SSR / page refresh there is no referrer, so both
 * defaultHref and defaultLabel are used unchanged.
 *
 * @param {string | import('vue').Ref<string>} defaultHref  - Fallback href (can be a ref)
 * @param {string | import('vue').Ref<string>} defaultLabel - Fallback label (can be a ref)
 */
export function useReferrer(defaultHref, defaultLabel) {
  const referrer = useState('slk_referrer', () => null)

  const resolvedDefault = () => (isRef(defaultHref) ? defaultHref.value : defaultHref)

  const backHref = computed(() => referrer.value || resolvedDefault())

  const backLabel = computed(() => {
    if (referrer.value && referrer.value !== resolvedDefault()) return 'Zurück'
    return isRef(defaultLabel) ? defaultLabel.value : defaultLabel
  })

  return { backHref, backLabel }
}
