import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";

/** Shared geometry for the news and events timelines, including the visible header. */
export function useTimelineNavigation() {
  const headerHeight = useHeaderHeight();
  const mobileHeaderHidden = useMobileHeaderHidden();
  const isDesktop = useState<boolean>("layout-isDesktop");
  const pillTop = computed(() => (isDesktop.value ? headerHeight.value : mobileHeaderHidden.value ? 0 : 64));
  const mobilePillStrip = ref<HTMLElement | null>(null);
  const activeSection = ref<string | null>(null);
  const navigationHeight = ref(44);
  const sectionOffset = computed(() => pillTop.value + navigationHeight.value + 16);
  let sectionObserver: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  watch(activeSection, (id) => {
    const strip = mobilePillStrip.value;
    const pill =
      strip && Array.from(strip.querySelectorAll<HTMLAnchorElement>("a")).find((link) => link.hash === `#${id}`);
    if (!strip || !pill) return;
    // scrollIntoView also moves the document, causing jumps while its observer runs.
    strip.scrollTo({
      left: pill.offsetLeft - strip.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  });
  onMounted(async () => {
    await nextTick();
    const navigation = mobilePillStrip.value?.parentElement;
    if (navigation) {
      resizeObserver = new ResizeObserver(() => {
        navigationHeight.value = navigation.getBoundingClientRect().height;
      });
      resizeObserver.observe(navigation);
    }
    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) activeSection.value = entry.target.id;
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    document.querySelectorAll('[id^="section-"]').forEach((section) => sectionObserver?.observe(section));
  });
  onBeforeUnmount(() => {
    sectionObserver?.disconnect();
    resizeObserver?.disconnect();
  });
  return { headerHeight, isDesktop, pillTop, sectionOffset, activeSection, mobilePillStrip };
}
