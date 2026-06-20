<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div class="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40" @click.self="$emit('close')">
      <!-- Sheet -->
      <div class="flex flex-col overflow-hidden rounded-t-2xl bg-white" style="max-height: 92vh">
        <!-- Sticky header -->
        <div class="border-gray-100 flex flex-none items-center justify-between border-b px-5 py-4">
          <h2 class="text-gray-900 text-base font-bold">Alle Datensätze</h2>
          <button
            class="hover:bg-gray-100 text-gray-500 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            aria-label="Schließen"
            @click="$emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Sector filter chips -->
        <div class="no-scrollbar border-gray-100 flex flex-none items-center gap-2 overflow-x-auto border-b px-5 py-3">
          <button
            class="flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="activeFilter === null ? 'bg-[#006e94] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="activeFilter = null"
          >
            Alle ({{ collections.length }})
          </button>
          <button
            v-for="sector in availableSectors"
            :key="sector.key"
            class="flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            :class="activeFilter === sector.key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            :style="activeFilter === sector.key ? `background: ${sector.color}` : ''"
            @click="activeFilter = sector.key"
          >
            {{ sector.label }} ({{ sector.count }})
          </button>
        </div>

        <!-- Scrollable grid -->
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <template v-for="sector in sectorsToShow" :key="sector.key">
            <h3 class="text-gray-400 mb-3 mt-4 text-xs font-semibold uppercase tracking-wide first:mt-0">
              {{ sector.label }}
            </h3>
            <div class="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="col in sector.collections"
                :key="col.id"
                class="border-gray-100 group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-all hover:border-[#006e94]/30 hover:shadow-md"
                @click="selectCollection(col.id)"
              >
                <!-- Cover image -->
                <div class="bg-gray-100 relative h-24 overflow-hidden">
                  <img
                    v-if="coverImageUrl(col)"
                    :src="coverImageUrl(col)"
                    :alt="t(col.title)"
                    class="h-full w-full object-cover"
                  />
                  <span
                    v-if="coverImageUrl(col) && coverImageAttribution(col)"
                    class="pointer-events-none absolute bottom-1.5 right-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white/90 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                    :title="coverImageAttribution(col)"
                  >
                    {{ coverImageAttribution(col) }}
                  </span>
                  <div
                    v-if="!coverImageUrl(col)"
                    class="h-full w-full"
                    :style="`background: linear-gradient(135deg, ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}18, ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}35)`"
                  />
                  <span
                    class="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
                    :style="`background: ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}`"
                  >
                    {{ sector.label }}
                  </span>
                </div>
                <!-- Title -->
                <div class="p-3">
                  <p class="text-gray-900 line-clamp-2 text-xs font-semibold leading-snug">
                    {{ t(col.title) }}
                  </p>
                </div>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { Collection } from "~/types/slz-api";
import { useSlzLocale } from "~/composables/useSlzLocale";
import { collectionCoverImage } from "~/utils/dataProducts";

const SECTOR_COLORS: Record<string, string> = {
  energy: "#F59E0B",
  transport: "#3B82F6",
  agriculture: "#10B981",
  management: "#006e94",
  other: "#6B7280",
};

const props = defineProps<{
  collections: Collection[];
  areaSlug: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", collectionId: string): void;
}>();

const { t } = useSlzLocale();
const runtimeConfig = useRuntimeConfig();
const activeFilter = ref<string | null>(null);

function coverImage(col: Collection) {
  return collectionCoverImage(col, runtimeConfig.public.clientDirectusUrl);
}

function coverImageUrl(col: Collection) {
  return coverImage(col).url;
}

function coverImageAttribution(col: Collection) {
  return coverImage(col).attribution;
}

function sectorKey(col: Collection) {
  return col.sector?.toLowerCase() ?? "other";
}

function sectorLabel(col: Collection) {
  const sl = col.sector_label;
  if (!sl) return col.sector ?? "";
  if (typeof sl === "string") return sl;
  return t(sl as Record<string, string>);
}

// Build unique sector list (ordered by appearance)
const availableSectors = computed(() => {
  const seen = new Map<string, { key: string; label: string; color: string; count: number }>();
  for (const col of props.collections) {
    const key = sectorKey(col);
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        label: sectorLabel(col),
        color: SECTOR_COLORS[key] ?? SECTOR_COLORS.other,
        count: 0,
      });
    }
    seen.get(key)!.count++;
  }
  return [...seen.values()];
});

const sectorsToShow = computed(() => {
  const filtered = activeFilter.value
    ? availableSectors.value.filter((s) => s.key === activeFilter.value)
    : availableSectors.value;

  return filtered.map((s) => ({
    ...s,
    collections: props.collections.filter((c) => sectorKey(c) === s.key),
  }));
});

function selectCollection(id: string) {
  emit("select", id);
  emit("close");
}

// Body scroll lock
onMounted(() => {
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
});
</script>
