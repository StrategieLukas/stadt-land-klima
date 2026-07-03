<template>
  <span
    class="inline-flex items-center justify-center rounded-full border font-semibold transition-transform duration-200 group-hover:scale-105"
    :class="[
      isPaid
        ? 'border-solid-stats-dark-20 bg-stats-light text-stats-dark'
        : 'border-solid-light-green-40 bg-rating-3-very-light text-olive-green',
      showLabel ? 'gap-2 px-3 py-2 text-sm' : 'h-11 w-11'
    ]"
    :aria-label="label"
    :title="label"
  >
    <span
      class="flex h-7 w-7 items-center justify-center rounded-full bg-white"
      :class="isPaid ? 'text-stats-dark' : 'text-olive-green'"
      aria-hidden="true"
    >
      <svg
        v-if="isPaid"
        class="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6.5 10.5h.01M17.5 14.5h.01" />
      </svg>
      <img
        v-else
        src="~/assets/icons/icon_hand_holding_heart.svg"
        class="h-5 w-5"
        alt=""
      >
    </span>
    <span :class="showLabel ? '' : 'sr-only'">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isPaid: boolean
  label: string
  showLabel?: boolean
}>(), {
  showLabel: false,
})
</script>
