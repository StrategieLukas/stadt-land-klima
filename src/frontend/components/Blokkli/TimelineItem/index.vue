<template>
  <div :id="'block-' + uuid" class="blokkli-block-timeline-item relative pb-10 pl-12">
    <!-- Dot on the line -->
    <div
      class="timeline-item-dot absolute left-0 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full"
      :class="dotBgClass"
    >
      <Icon v-if="options.icon" :icon="options.icon" class="h-4 w-4 text-white" />
      <div v-else class="h-3 w-3 rounded-full bg-white opacity-80" />
    </div>

    <!-- Date / label -->
    <span
      v-if="props.date || isEditing"
      v-blokkli-editable:date
      class="mb-1 block text-xs font-bold uppercase tracking-widest"
      :class="accentTextClass"
      v-text="props.date"
    />

    <!-- Title -->
    <h3 v-blokkli-editable:title class="mb-2 text-lg font-bold leading-snug text-black" v-text="props.title" />

    <!-- Description / nested blocks -->
    <BlokkliField name="blocks" :list="props.blocks || []" tag="div" class="mt-1 flex flex-col gap-3" />
  </div>
</template>

<script setup lang="ts">
import type { FieldListItem } from "#blokkli/types";
import { Icon } from "@iconify/vue";

const isEditing = import.meta.blokkliEditing;

const { options, uuid } = defineBlokkli({
  bundle: "timeline_item",
  propsFieldMapping: {
    blocks: { name: "blocks", type: "field" },
    date: { name: "date", type: "editable" },
    title: { name: "title", type: "editable" },
  },
  options: {
    color: {
      type: "radios",
      label: "Farbe",
      default: "green",
      displayAs: "colors",
      options: {
        green: { label: "Grün", hex: "#1da64a" },
        blue: { label: "Blau", hex: "#16bae7" },
        dark: { label: "Dunkelblau", hex: "#006e94" },
        orange: { label: "Orange", hex: "#f39200" },
        lime: { label: "Hellgrün", hex: "#AFCA0B" },
      },
    },
    icon: {
      type: "text",
      label: "Icon (z.B. mdi:star)",
      default: "",
      inputType: "text",
    },
  },
  editor: {
    addBehaviour: "editable:title",
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || "Zeitstrahl-Eintrag",
    mockProps: () => {
      return { date: "2024", title: "Meilenstein", blocks: [] };
    },
  },
});

const props = defineProps<{
  date?: string | undefined;
  title?: string | undefined;
  blocks?: FieldListItem[] | undefined;
}>();

const colorMap: Record<string, { bg: string; text: string }> = {
  green: { bg: "bg-ff-green", text: "text-ff-green" },
  blue: { bg: "bg-light-blue", text: "text-light-blue" },
  dark: { bg: "bg-stats-dark", text: "text-stats-dark" },
  orange: { bg: "bg-orange", text: "text-orange" },
  lime: { bg: "bg-light-green", text: "text-light-green" },
};

const currentColor = computed(() => colorMap[options.value.color] || colorMap.green!);
const dotBgClass = computed(() => currentColor.value.bg);
const accentTextClass = computed(() => currentColor.value.text);
</script>

<style scoped>
.blokkli-block-timeline-item {
  width: 100%;
}
</style>
