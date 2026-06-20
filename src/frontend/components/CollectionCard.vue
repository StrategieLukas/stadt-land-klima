<template>
  <NuxtLink
    :to="`/data/${areaSlug}/${collection.id}`"
    class="border-gray-100 group flex w-64 flex-none snap-start flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:border-[#006e94]/30 hover:shadow-md"
    @click="startDataRouteFeedback(`${t(collection.title)} wird geladen...`)"
  >
    <!-- Cover image / placeholder -->
    <div class="bg-gray-100 relative h-32 flex-none overflow-hidden">
      <img
        v-if="coverImageUrl"
        :src="coverImageUrl"
        :alt="t(collection.title)"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center"
        :style="`background: linear-gradient(135deg, ${sectorColor}18, ${sectorColor}35)`"
      >
        <img v-if="sectorIcon" :src="sectorIcon" class="h-10 w-10 opacity-30" :alt="sectorLabel" />
        <div v-else class="h-10 w-10 rounded-full" :style="`background: ${sectorColor}25`" />
      </div>
      <!-- Sector badge -->
      <span
        v-if="sectorLabel"
        class="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
        :style="`background: ${sectorColor}`"
        >{{ sectorLabel }}</span
      >
    </div>

    <!-- Text body -->
    <div class="flex min-h-0 flex-1 flex-col p-4">
      <h3
        class="text-gray-900 mb-1 line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-[#006e94]"
      >
        {{ t(collection.title) }}
      </h3>
      <p v-if="description" class="text-gray-500 line-clamp-3 flex-1 text-xs leading-relaxed">{{ description }}</p>
    </div>

    <!-- Footer arrow -->
    <div class="flex items-center justify-end px-4 pb-3">
      <span class="text-xs font-medium text-[#006e94] transition-transform group-hover:translate-x-0.5">
        Erkunden →
      </span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Collection } from "~/types/slz-api";
import { useSlzLocale } from "~/composables/useSlzLocale";
import sectorImages from "~/shared/sectorImages.js";
import { collectionCoverImageUrl } from "~/utils/dataProducts";

const SECTOR_COLORS: Record<string, string> = {
  energy: "#F59E0B",
  transport: "#3B82F6",
  agriculture: "#10B981",
  management: "#006e94",
  other: "#6B7280",
};

const props = defineProps<{
  collection: Collection;
  areaSlug: string;
  sectorLabel?: string;
  sectorKey?: string;
}>();

const { t } = useSlzLocale();
const { start: startDataRouteFeedback } = useDataRouteFeedback();

const description = computed(
  () => props.collection.description?.["de-DE"] || props.collection.description?.["en-US"] || "",
);

const coverImageUrl = computed(() => collectionCoverImageUrl(props.collection));

const sectorColor = computed(() => SECTOR_COLORS[props.sectorKey ?? "other"] ?? SECTOR_COLORS.other);

const sectorIcon = computed(() =>
  props.sectorKey ? ((sectorImages as Record<string, string>)[props.sectorKey] ?? null) : null,
);
</script>
