<template>
  <div class="overflow-x-auto">
    <table class="table w-full">
      <thead>
        <tr>
          <th>Statistik</th>
          <th>Wert</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(value, key) in displayStats" :key="key">
          <td class="capitalize">{{ key.replaceAll('_', ' ') }}</td>
          <td>{{ value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  stats: Object
});

const displayStats = computed(() => {
  // Customize filtering/sorting if needed
  const { name, slug, ...rest } = stats;
  return rest;
});
</script>
