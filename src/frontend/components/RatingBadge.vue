<template>
  <span 
    class="rating-badge inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-medium"
    :class="[sizeClasses, colorClasses]"
  >
    <span class="rating-dot w-2 h-2 rounded-full" :class="dotColorClass" />
    <span v-if="showLabel">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { RATING_DISPLAY } from '~/shared/ratingEngine';

const props = defineProps({
  rating: {
    type: String,
    default: null,
    validator: (value) => value === null || ['dark_green', 'light_green', 'yellow', 'orange', 'red'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  showLabel: {
    type: Boolean,
    default: false
  }
});

const label = computed(() => {
  if (!props.rating) return 'Keine Bewertung';
  return RATING_DISPLAY[props.rating]?.label || props.rating;
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'text-xs';
    case 'lg': return 'text-base px-3 py-1.5';
    default: return 'text-sm';
  }
});

const colorClasses = computed(() => {
  if (!props.rating) return 'bg-gray-100 text-gray-600';
  
  switch (props.rating) {
    case 'dark_green':
      return 'bg-emerald-100 text-emerald-800';
    case 'light_green':
      return 'bg-green-100 text-green-700';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-800';
    case 'orange':
      return 'bg-orange-100 text-orange-800';
    case 'red':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
});

const dotColorClass = computed(() => {
  if (!props.rating) return 'bg-gray-400';
  
  switch (props.rating) {
    case 'dark_green':
      return 'bg-emerald-600';
    case 'light_green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'orange':
      return 'bg-orange-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
});
</script>
