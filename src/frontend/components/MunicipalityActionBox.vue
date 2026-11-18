<template>
  <section
    class="border border-(--slk-border) p-4 sm:p-5"
    :class="tone === 'orange' ? 'bg-(--slk-orange-tint)' : 'bg-(--slk-green-tint)'"
  >
    <div class="mb-2 flex items-center gap-3">
      <Icon
        :icon="icon"
        class="h-6 w-6 shrink-0"
        :class="tone === 'orange' ? 'text-(--slk-orange)' : 'text-(--slk-green)'"
        :ariaHidden="true"
      />
      <h2 class="font-heading text-h2 font-bold text-(--slk-text-strong)">
        {{ title }}
      </h2>
    </div>
    <p class="mb-4 max-w-3xl text-sm leading-relaxed text-(--slk-text)">{{ description }}</p>
    <div class="flex flex-wrap gap-3"><slot /></div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";

defineProps<{
  title: string;
  description: string;
  icon: string;
  tone: "orange" | "green";
}>();
</script>
