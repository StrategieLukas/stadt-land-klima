<template>
  <span class="thesis-category-badges">
    <v-chip
      v-for="choice in badges"
      :key="choice.value"
      :style="{ '--v-chip-color': choice.foreground, '--v-chip-background-color': choice.background }"
      small
      disabled
      label
    >
      {{ choice.text }}
    </v-chip>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { mergeThesisCategories } from "../../../../../frontend/shared/thesisCategories";

const props = defineProps<{
  value?: unknown;
  choices?: { value: string; text: string; foreground?: string; background?: string }[];
}>();

const badges = computed(() =>
  (Array.isArray(props.value) ? mergeThesisCategories(props.value) : []).flatMap((value) => {
    if (typeof value !== "string") return [];
    return [props.choices?.find((choice) => choice.value === value) ?? { value, text: value }];
  }),
);
</script>

<style scoped>
.thesis-category-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.25rem;
}
</style>
