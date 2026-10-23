<template>
  <div class="border-t-2 border-light-blue py-6">
    <h2 class="mb-4 font-heading text-h3 font-bold text-gray">Bewertung durch Kommunen</h2>

    <div v-if="!ratings || ratings.length === 0" class="text-gray-400 text-sm italic">
      Noch keine veröffentlichten Bewertungen für diese Maßnahme vorhanden.
    </div>

    <div v-else>
      <div class="space-y-2">
        <template v-for="group in ratingGroups" :key="group.key">
          <!-- Bar row -->
          <button
            class="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors"
            :class="group.count > 0 ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default opacity-40'"
            :disabled="group.count === 0"
            @click="group.count > 0 ? toggleGroup(group.key) : undefined"
          >
            <span class="flex w-44 flex-shrink-0 items-center gap-2">
              <span class="h-3 w-3 flex-shrink-0 rounded-full" :style="{ background: group.color }" />
              <span class="text-gray-700 truncate text-xs font-semibold">{{ group.label }}</span>
            </span>
            <span class="bg-gray-100 h-5 flex-1 overflow-hidden rounded">
              <span
                class="block h-full rounded transition-all duration-500"
                :style="{ width: `${(group.count / total) * 100}%`, background: group.color }"
              />
            </span>
            <span class="text-gray-700 w-8 flex-shrink-0 text-right text-xs font-bold">{{ group.count }}</span>
            <svg
              v-if="group.count > 0"
              class="text-gray-400 h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
              :class="{ 'rotate-180': openKey === group.key }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span v-else class="w-3.5 flex-shrink-0" />
          </button>

          <!-- Expanded municipality list -->
          <div
            v-if="openKey === group.key && group.municipalities.length"
            class="mx-2 mb-1 border-l-2 py-1 pl-4"
            :style="{ borderColor: group.color }"
          >
            <div class="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
              <NuxtLink
                v-for="mun in group.municipalities"
                :key="mun.href"
                :to="mun.href"
                class="truncate px-1 py-0.5 text-xs text-light-blue hover:underline"
              >
                {{ mun.name }} →
              </NuxtLink>
            </div>
          </div>
        </template>
      </div>

      <p class="text-gray-400 mt-3 text-xs">
        {{ total }} Kommune{{ total !== 1 ? "n haben" : " hat" }} diese Maßnahme bewertet.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { ComparisonRating } from "~/types/components/municipality";

import { ref, computed, watch } from "vue";

const props = defineProps({
  ratings: { type: Array as PropType<ComparisonRating[] | undefined>, default: () => [] },
  measureIdStr: { type: String, required: true },
  catalogVersionName: { type: String, required: true },
});

const RATING_CFG = [
  { key: "1", label: "Vollständig erfüllt", color: "#1da64a" },
  { key: "0.75", label: "Gut erfüllt", color: "#8bc34a" },
  { key: "0.5", label: "Teilweise erfüllt", color: "#fdd835" },
  { key: "0.25", label: "Kaum erfüllt", color: "#f39200" },
  { key: "0", label: "Nicht erfüllt", color: "#d32f2f" },
  { key: "na", label: "Nicht anwendbar", color: "#9e9e9e" },
  { key: "unrated", label: "Nicht bewertet", color: "#b0bec5" },
];

const openKey = ref<string | null>(null);

watch(
  () => props.measureIdStr,
  () => {
    openKey.value = null;
  },
);

function toggleGroup(key: string) {
  openKey.value = openKey.value === key ? null : key;
}

function getMunicipalityName(row: ComparisonRating) {
  return row.localteam_id?.municipality_name || row.localteam_id?.municipality_id?.[0]?.name || "–";
}

function getMunicipalityHref(row: ComparisonRating) {
  const mun = row.localteam_id?.municipality_id?.[0];
  if (!mun?.slug || mun?.status !== "published") return null;
  return `/municipalities/${mun.slug}?v=${props.catalogVersionName}#measure-${props.measureIdStr}`;
}

const ratingGroups = computed(() =>
  RATING_CFG.map((cfg) => {
    let rows;
    if (cfg.key === "na") {
      rows = props.ratings.filter((r) => r.applicable === false);
    } else if (cfg.key === "unrated") {
      rows = props.ratings.filter((r) => r.applicable !== false && r.rating == null);
    } else {
      rows = props.ratings.filter((r) => r.applicable !== false && r.rating === cfg.key);
    }

    const municipalities = rows
      .map((r) => ({ name: getMunicipalityName(r), href: getMunicipalityHref(r) }))
      .filter((m): m is { name: string; href: string } => Boolean(m.href))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return { ...cfg, count: municipalities.length, municipalities };
  }),
);

const total = computed(() => ratingGroups.value.reduce((s, g) => s + g.count, 0));
</script>
