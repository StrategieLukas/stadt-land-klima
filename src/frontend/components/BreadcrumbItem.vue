<!--
  BreadcrumbItem — a breadcrumb link with an optional sibling-area dropdown.

  Props:
    label        display text
    href         link target (when isCurrent=false, this is where clicking the label goes)
    isCurrent    true for the last (active) crumb — bold, no arrow
    siblingLevel administrative level of siblings to fetch (2 = Bundesländer, 4 = Kreise)
    arsPrefix    first N chars of ARS to scope sibling search (empty = fetch all at that level)
    currentArs   ARS of the currently-active area (highlighted in dropdown)
-->
<template>
  <div ref="container" class="relative">
    <!-- Label / toggle button -->
    <button
      type="button"
      class="flex items-center gap-0.5 leading-none transition-colors"
      :class="isCurrent ? 'text-gray-800 cursor-default font-semibold' : 'text-gray-500 hover:text-[#006e94]'"
      @click="toggle"
    >
      <NuxtLink
        v-if="!isCurrent && href"
        :to="href"
        class="transition-colors hover:text-[#006e94]"
        @click.stop="startNavigation(label)"
        >{{ label }}</NuxtLink
      >
      <span v-else>{{ label }}</span>
      <!-- Down-arrow shown for all non-current crumbs when dropdown is available -->
      <svg
        v-if="siblingLevel"
        class="ml-0.5 h-2.5 w-2.5 opacity-40 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="border-gray-200 absolute left-0 top-full z-[500] mt-1.5 max-h-[60vh] w-max min-w-[180px] max-w-xs overflow-hidden overflow-y-auto rounded-xl border bg-white shadow-2xl"
    >
      <div v-if="loading" class="text-gray-400 animate-pulse px-4 py-3 text-xs">Wird geladen…</div>
      <template v-else>
        <NuxtLink
          v-for="sibling in siblings"
          :key="sibling.ars"
          :to="`/data/${toSlug(sibling.prefix, sibling.name)}`"
          class="hover:bg-gray-50 flex items-baseline gap-2 px-3 py-2 text-xs transition-colors"
          :class="sibling.ars === currentArs ? 'bg-[#006e94]/5 font-semibold text-[#006e94]' : 'text-gray-700'"
          @click="selectSibling(sibling)"
        >
          <span class="text-gray-400 shrink-0 text-[10px]">{{ sibling.prefix }}</span>
          <span class="whitespace-nowrap">{{ sibling.name }}</span>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { areaToSlug } from "~/composables/useAreaBySlug.js";

const props = defineProps({
  label: { type: String, required: true },
  href: { type: String, default: null },
  isCurrent: { type: Boolean, default: false },
  siblingLevel: { type: Number, default: null },
  arsPrefix: { type: String, default: "" },
  currentArs: { type: String, default: null },
});

const toSlug = areaToSlug;
const { start: startDataRouteFeedback } = useDataRouteFeedback();

const container = ref(null);
const open = ref(false);
const loading = ref(false);
const siblings = ref([]);

async function fetchSiblings() {
  if (siblings.value.length || !props.siblingLevel) return;
  loading.value = true;
  try {
    const params = new URLSearchParams({ level: String(props.siblingLevel) });
    if (props.arsPrefix) params.set("arsPrefix", props.arsPrefix);
    const data = await $fetch(`/api/area-children?${params}`);
    siblings.value = data ?? [];
  } catch {
    siblings.value = [];
  } finally {
    loading.value = false;
  }
}

async function toggle() {
  if (!props.siblingLevel) return;
  if (!open.value) {
    open.value = true;
    await fetchSiblings();
  } else {
    open.value = false;
  }
}

function startNavigation(nextLabel) {
  startDataRouteFeedback(`${nextLabel} wird geladen...`);
}

function selectSibling(sibling) {
  open.value = false;
  startNavigation(sibling.name);
}

// Close on outside click
function onOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener("click", onOutside, { passive: true }));
onBeforeUnmount(() => document.removeEventListener("click", onOutside));
</script>
