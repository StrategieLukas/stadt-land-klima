import { onMounted, onUnmounted, ref, watch } from 'vue'

type SectionScrollSpyOptions = {
  sectionSelector?: string
  rootMargin?: string
  threshold?: number
  observeDelayMs?: number
}

export function useSectionScrollSpy({
  sectionSelector = '[id^="section-"]',
  rootMargin = '-20% 0px -70% 0px',
  threshold = 0,
  observeDelayMs = 100,
}: SectionScrollSpyOptions = {}) {
  const activeSection = ref<string | null>(null)
  const mobilePillStrip = ref<HTMLElement | null>(null)
  let sectionObserver: IntersectionObserver | null = null

  function scrollActivePillIntoView(sectionId: string | null) {
    if (!sectionId || !mobilePillStrip.value) return

    const pill = mobilePillStrip.value.querySelector(`[href="#${sectionId}"]`)
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  function observeSections() {
    const sections = document.querySelectorAll(sectionSelector)
    if (!sections.length) return

    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeSection.value = entry.target.id
          }
        }
      },
      { rootMargin, threshold },
    )

    sections.forEach((section) => sectionObserver?.observe(section))
  }

  watch(activeSection, scrollActivePillIntoView)

  onMounted(() => {
    window.setTimeout(observeSections, observeDelayMs)
  })

  onUnmounted(() => {
    sectionObserver?.disconnect()
  })

  return {
    activeSection,
    mobilePillStrip,
  }
}
