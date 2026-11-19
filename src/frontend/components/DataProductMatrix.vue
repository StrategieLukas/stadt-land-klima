<template>
  <div class="data-product-matrix">
    <div class="data-product-matrix-grid" :style="fillStyle"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ count: number }>();
const fillStyle = computed(() => ({
  "--data-products-fill-2": 2 - (props.count % 2),
  "--data-products-fill-3": 3 - (props.count % 3),
  "--data-products-fill-4": 4 - (props.count % 4),
}));
</script>

<style scoped>
.data-product-matrix {
  container: data-products / inline-size;
  min-width: 0;
}
.data-product-matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  --data-products-fill: var(--data-products-fill-2);
}
@container data-products (min-width: 420px) {
  .data-product-matrix-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    --data-products-fill: var(--data-products-fill-3);
  }
}
@container data-products (min-width: 600px) {
  .data-product-matrix-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    --data-products-fill: var(--data-products-fill-4);
  }
}
</style>
