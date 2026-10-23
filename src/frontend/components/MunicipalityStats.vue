<template>
  <div class="overflow-x-auto">
    <table class="table w-full">
      <thead>
        <tr>
          <th>{{ $t("stats.statistic") }}</th>
          <th>{{ $t("stats.value") }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(value, key) in displayStats" :key="key">
          <td class="capitalize">{{ key.replaceAll("_", " ") }}</td>
          <td>{{ value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

const props = defineProps({
  stats: Object as PropType<Record<string, unknown>>,
});

const displayStats = computed(() => {
  // Customize filtering/sorting if needed
  const { name, slug, ...rest } = props.stats ?? {};
  return rest;
});
</script>
