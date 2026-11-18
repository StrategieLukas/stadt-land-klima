<template>
  <span class="participation-icon inline-flex shrink-0 items-center justify-center" aria-hidden="true">
    <!-- eslint-disable vue/no-v-html -- Prepared SVG comes exclusively from checked-in SLK assets. -->
    <span v-if="svg" class="h-full w-full [&>svg]:h-full [&>svg]:w-full" v-html="svg" />
    <!-- eslint-enable vue/no-v-html -->
    <span v-else>{{ symbols[icon] || "↗" }}</span>
  </span>
</template>
<script setup lang="ts">
import { prepareButtonIcons } from "~/utils/buttonIcons";
const props = defineProps<{ icon: string }>();
const files = import.meta.glob<string>("@/assets/icons/*.svg", { query: "?raw", import: "default", eager: true });
const assets = prepareButtonIcons(files, "canonical");
const names: Record<string, string> = {
  "mdi:code-braces": "icon_category_management",
  "mdi:graph-outline": "icon_team",
  "mdi:draw-pen": "icon_invest",
  "mdi:tree-outline": "icon_category_agriculture",
  "mdi:map-marker-outline": "icon_location",
  "mdi:town-hall": "icon_category_buildings",
  "mdi:chart-bar": "icon_list_view",
  "mdi:checkbox-marked-outline": "icon_politics",
  "mdi:sprout-outline": "icon_category_agriculture",
};
const symbols: Record<string, string> = {
  "mdi:arrow-left": "←",
  "mdi:arrow-right": "→",
  "mdi:chevron-left": "‹",
  "mdi:chevron-right": "›",
  "mdi:plus": "+",
  "mdi:check": "✓",
  "mdi:check-circle": "✓",
  "mdi:check-circle-outline": "✓",
  "mdi:circle-outline": "○",
  "mdi:compass-outline": "↗",
};
const svg = computed(() => assets[names[props.icon] ?? ""] ?? "");
</script>
