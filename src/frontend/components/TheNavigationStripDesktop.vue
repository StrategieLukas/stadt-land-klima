<template>
  <nav
    ref="navRef"
    class="slk-navigation-strip border-t border-(--slk-border)"
    @keydown.esc.prevent="closeMenu(true)"
    @focusout="focusOut"
  >
    <ul class="mx-auto flex max-w-(--breakpoint-xl) flex-wrap justify-center px-2">
      <li
        v-for="item in safeItems"
        :key="item.id"
        :data-navigation-id="item.id"
        class="flex min-h-10 items-stretch"
        @mouseenter="scheduleOpen(item)"
        @mouseleave="scheduleClose"
      >
        <NavigationDestination
          v-if="!item.children?.length"
          :item="item"
          class="nav-label flex items-center px-3 py-2 text-sm font-semibold"
          :current="isActive(item) ? 'page' : undefined"
          @click="closeMenu()"
          @focusin="closeMenu()"
          >{{ navLabel(item) }}</NavigationDestination
        >
        <div
          v-else
          class="flex items-stretch"
          :class="{ 'nav-active': isActive(item) || item.children.some(isActive) || openItem?.id === item.id }"
        >
          <NavigationDestination
            v-if="item.link_type === 'page' && item.page_slug"
            :item="item"
            class="nav-label flex items-center py-2 pr-1 pl-3 text-sm font-semibold"
            @click="closeMenu()"
            @keydown.down.prevent="openMenu(item, true)"
            >{{ navLabel(item) }}</NavigationDestination
          >
          <button
            v-else
            type="button"
            class="nav-label cursor-pointer py-2 pr-1 pl-3 text-sm font-semibold"
            :aria-expanded="openItem?.id === item.id"
            :aria-controls="panelId"
            @click="toggleMenu(item)"
            @keydown.down.prevent="openMenu(item, true)"
          >
            {{ navLabel(item) }}
          </button>
          <button
            type="button"
            :data-nav-trigger="item.id"
            class="nav-label flex cursor-pointer items-center pr-3 pl-1"
            :aria-label="$t('navigation.submenu_for', { ':label': navLabel(item) })"
            :aria-expanded="openItem?.id === item.id"
            :aria-controls="panelId"
            @click="toggleMenu(item)"
            @keydown.down.prevent="openMenu(item, true)"
          >
            <Icon
              icon="mdi:chevron-down"
              class="h-4 w-4 transition-transform"
              :class="{ 'rotate-180': openItem?.id === item.id }"
            />
          </button>
        </div>
      </li>
    </ul>
    <Teleport to="body">
      <Transition name="navigation-panel">
        <div
          v-if="openItem"
          :id="panelId"
          ref="panelRef"
          class="navigation-panel fixed z-10001 overflow-hidden rounded-xl border border-(--slk-border) bg-(--slk-surface) p-2 text-(--slk-text) shadow-xl"
          :style="panelStyle"
          :aria-label="navLabel(openItem)"
          @mouseenter="cancelClose"
          @mouseleave="scheduleClose"
          @focusout="focusOut"
          @keydown.esc.prevent.stop="closeMenu(true)"
        >
          <Transition name="navigation-content" @before-leave="retireContent">
            <div
              :key="openItem.id"
              ref="contentRef"
              class="navigation-content overflow-auto"
              :style="{ maxHeight: contentMaxHeight }"
              :class="
                layout === 'preview'
                  ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2'
                  : layout === 'cards'
                    ? 'grid grid-cols-2 gap-2'
                    : 'flex flex-col'
              "
            >
              <template v-if="layout === 'preview'">
                <ul class="min-w-0">
                  <li v-for="child in openItem.children" :key="child.id">
                    <NavigationDestination
                      :item="child"
                      class="nav-destination block rounded-lg px-2.5 py-2"
                      :current="isActive(child) ? 'page' : undefined"
                      @mouseenter="previewId = child.id"
                      @focusin="previewId = child.id"
                      @click="closeMenu()"
                      ><span class="block text-sm font-bold">{{ navLabel(child) }}</span
                      ><span
                        v-if="navDescription(child)"
                        class="mt-0.5 block text-xs leading-snug text-(--slk-text-subtle)"
                        >{{ navDescription(child) }}</span
                      ></NavigationDestination
                    >
                  </li>
                </ul>
                <div class="relative min-h-44 overflow-hidden rounded-lg bg-(--slk-surface-subdued)" aria-hidden="true">
                  <Transition name="navigation-image"
                    ><img
                      v-if="previewItem && imageUrl(previewItem)"
                      :key="previewItem.id"
                      :src="imageUrl(previewItem)"
                      alt=""
                      class="absolute inset-0 h-full w-full object-cover" />
                    <div
                      v-else
                      :key="previewItem?.id ?? 'empty'"
                      class="absolute inset-0 flex min-h-44 items-center justify-center p-4"
                    >
                      <Icon :icon="previewItem?.icon || 'mdi:leaf'" class="h-16 w-16 text-light-green" /></div
                  ></Transition>
                </div>
              </template>
              <template v-else>
                <NavigationDestination
                  v-for="child in openItem.children"
                  :key="child.id"
                  :item="child"
                  class="nav-destination group rounded-lg"
                  :class="
                    layout === 'cards'
                      ? 'relative flex min-h-44 flex-col justify-end overflow-hidden bg-(--slk-surface-subdued) p-3'
                      : 'block px-2.5 py-2'
                  "
                  :current="isActive(child) ? 'page' : undefined"
                  @click="closeMenu()"
                >
                  <template v-if="layout === 'cards' && imageUrl(child)"
                    ><img
                      :src="imageUrl(child)"
                      alt=""
                      class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /><span
                      class="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent"
                  /></template>
                  <Icon
                    v-else-if="layout === 'cards'"
                    :icon="child.icon || 'mdi:leaf'"
                    class="mb-3 h-8 w-8 text-light-green"
                  />
                  <span class="relative" :class="{ 'text-white': layout === 'cards' && imageUrl(child) }"
                    ><span class="block text-sm font-bold"
                      >{{ navLabel(child)
                      }}<Icon
                        v-if="child.link_type === 'external'"
                        icon="mdi:arrow-top-right"
                        class="ml-1 inline h-3 w-3" /></span
                    ><span v-if="navDescription(child)" class="mt-0.5 block text-xs leading-snug opacity-85">{{
                      navDescription(child)
                    }}</span></span
                  >
                </NavigationDestination>
              </template>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from "vue";
import type { CSSProperties } from "vue";
import type { NavigationItem } from "~/types/components/navigation";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel";
import { navigationDestination, navigationDropdownLayout } from "~/utils/navigationDropdown";
const props = defineProps<{ items?: NavigationItem[] | undefined }>();
const { $t, $translateDynamic } = useNuxtApp();
const config = useRuntimeConfig();
const route = useRoute();
const { navigationDropdownOpen } = useSearchPalette();
const navRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const contentMaxHeight = ref("none");
let contentObserver: ResizeObserver | undefined;
const panelId = useId();
const openId = ref<string | number | null>(null);
const previewId = ref<string | number | null>(null);
const panelStyle = ref<CSSProperties>({});
const safeItems = computed(() => (Array.isArray(props.items) ? props.items : []));
const openItem = computed(() => safeItems.value.find((item) => item.id === openId.value) ?? null);
watch(
  openItem,
  (item) => {
    navigationDropdownOpen.value = !!item;
  },
  { flush: "sync" },
);
watch(navigationDropdownOpen, (open) => {
  if (!open) closeMenu();
});
const previewItem = computed(
  () => openItem.value?.children?.find((item) => item.id === previewId.value) ?? openItem.value?.children?.[0],
);
const layout = computed(() => (openItem.value ? navigationDropdownLayout(openItem.value) : "list"));
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let openTimer: ReturnType<typeof setTimeout> | undefined;
function navLabel(item: NavigationItem) {
  return translatedNavigationLabel(item, $translateDynamic);
}
function navDescription(item: NavigationItem) {
  return item.description ? translatedNavigationLabel(item, $translateDynamic, "description") : "";
}
function imageUrl(item: NavigationItem) {
  return item.image_id && /^[a-f0-9-]{36}$/i.test(item.image_id)
    ? `${config.public.clientDirectusUrl}/assets/${item.image_id}?width=720&quality=80`
    : undefined;
}
function isActive(item: NavigationItem) {
  const destination = navigationDestination(item);
  return (
    destination.type === "page" &&
    (route.path === destination.href || (destination.href !== "/" && route.path.startsWith(`${destination.href}/`)))
  );
}
function anchor() {
  return openItem.value
    ? navRef.value?.querySelector<HTMLElement>(`[data-navigation-id="${CSS.escape(String(openItem.value.id))}"]`)
    : null;
}
function position() {
  const element = anchor();
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const header = element.closest("header")?.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top >= window.innerHeight || (header && rect.bottom > header.bottom + 1)) {
    closeMenu();
    return;
  }
  const width = Math.min(
    layout.value === "preview" ? 560 : layout.value === "cards" ? 460 : 280,
    window.innerWidth - 32,
  );
  const availableHeight = Math.max(100, window.innerHeight - rect.bottom - 20);
  contentMaxHeight.value = `${availableHeight - 18}px`;
  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16))}px`,
    width: `${width}px`,
    height: `${Math.min((contentRef.value?.scrollHeight ?? 0) + 18, availableHeight)}px`,
    maxHeight: `${availableHeight}px`,
  };
}
function retireContent(element: Element) {
  element.setAttribute("inert", "");
  element.setAttribute("aria-hidden", "true");
}
watch(contentRef, (element) => {
  contentObserver?.disconnect();
  if (element) {
    contentObserver = new ResizeObserver(position);
    contentObserver.observe(element);
  }
});
function cancelClose() {
  clearTimeout(closeTimer);
}
async function openMenu(item: NavigationItem, focus = false) {
  clearTimeout(openTimer);
  cancelClose();
  if (!item.children?.length) return;
  const focusWasInside = contentRef.value?.contains(document.activeElement) ?? false;
  if (openId.value !== item.id) previewId.value = item.children[0]?.id ?? null;
  openId.value = item.id;
  await nextTick();
  position();
  if (focus || focusWasInside) contentRef.value?.querySelector<HTMLElement>("[data-nav-destination]")?.focus();
}
function scheduleOpen(item: NavigationItem) {
  clearTimeout(openTimer);
  cancelClose();
  if (!item.children?.length) {
    closeMenu();
    return;
  }
  openTimer = setTimeout(() => void openMenu(item), openItem.value ? 60 : 120);
}
function scheduleClose() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    closeMenu();
  }, 200);
}
function closeMenu(focus = false) {
  clearTimeout(closeTimer);
  clearTimeout(openTimer);
  if (focus && openItem.value)
    navRef.value?.querySelector<HTMLElement>(`[data-nav-trigger="${CSS.escape(String(openItem.value.id))}"]`)?.focus();
  openId.value = null;
}
function toggleMenu(item: NavigationItem) {
  if (openId.value === item.id) closeMenu();
  else void openMenu(item);
}
function outside(event: MouseEvent) {
  if (event.target instanceof Node && !navRef.value?.contains(event.target) && !panelRef.value?.contains(event.target))
    closeMenu();
}
function focusOut(event: FocusEvent) {
  if (event.target instanceof Element && event.target.closest("[inert]")) return;
  if (
    !(event.relatedTarget instanceof Node) ||
    (!navRef.value?.contains(event.relatedTarget) && !panelRef.value?.contains(event.relatedTarget))
  )
    closeMenu();
}
watch(
  () => route.fullPath,
  () => {
    closeMenu();
  },
);
onMounted(() => {
  document.addEventListener("click", outside);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, { passive: true });
});
onUnmounted(() => {
  contentObserver?.disconnect();
  closeMenu();
  document.removeEventListener("click", outside);
  window.removeEventListener("resize", position);
  window.removeEventListener("scroll", position);
});
</script>

<style scoped>
.nav-label {
  color: var(--slk-text);
  transition:
    background 150ms,
    color 150ms;
}
.nav-label:hover,
.nav-label[aria-current="page"],
.nav-active,
.nav-destination:hover,
.nav-destination[aria-current="page"] {
  background: var(--slk-surface-subdued);
  color: var(--slk-text-strong);
}
.nav-label:focus-visible,
.nav-destination:focus-visible {
  outline: 2px solid var(--slk-blue, #006e94);
  outline-offset: -2px;
}
.navigation-panel {
  transition:
    left 220ms cubic-bezier(0.22, 1, 0.36, 1),
    top 220ms cubic-bezier(0.22, 1, 0.36, 1),
    width 220ms cubic-bezier(0.22, 1, 0.36, 1),
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease,
    transform 160ms ease;
}
.navigation-content-enter-active,
.navigation-content-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.navigation-content-leave-active {
  position: absolute;
  inset: 8px;
  pointer-events: none;
}
.navigation-content-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.navigation-content-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.navigation-panel-enter-from,
.navigation-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.navigation-image-enter-active,
.navigation-image-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.navigation-image-enter-from,
.navigation-image-leave-to {
  opacity: 0;
  transform: scale(1.025);
}
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
</style>
