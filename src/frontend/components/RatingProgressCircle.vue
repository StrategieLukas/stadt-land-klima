<template>
  <div class="rating-progress-circle" :class="sizeClass">
    <svg :viewBox="`0 0 ${size} ${size}`" class="progress-svg">
      <!-- Background circle -->
      <circle
        class="progress-bg"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
      />
      <!-- Progress circle -->
      <circle
        class="progress-bar"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="progressOffset"
        :stroke="progressColor"
        stroke-linecap="round"
      />
    </svg>
    <div class="progress-content">
      <span class="progress-value">{{ Math.round(percentage) }}%</span>
      <span v-if="showLabel" class="progress-label">{{ label }}</span>
      <span v-if="showCount" class="progress-count">{{ rated }}/{{ total }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  rated: {
    type: Number,
    required: true,
    default: 0
  },
  total: {
    type: Number,
    required: true,
    default: 1
  },
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'small', 'large'].includes(v)
  },
  showLabel: {
    type: Boolean,
    default: true
  },
  showCount: {
    type: Boolean,
    default: true
  },
  label: {
    type: String,
    default: 'bewertet'
  }
});

// Size configurations
const sizeConfigs = {
  small: { size: 80, strokeWidth: 6 },
  default: { size: 120, strokeWidth: 8 },
  large: { size: 160, strokeWidth: 10 }
};

const config = computed(() => sizeConfigs[props.variant] || sizeConfigs.default);
const size = computed(() => config.value.size);
const strokeWidth = computed(() => config.value.strokeWidth);
const center = computed(() => size.value / 2);
const radius = computed(() => (size.value - strokeWidth.value) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);

const percentage = computed(() => {
  if (props.total === 0) return 0;
  return (props.rated / props.total) * 100;
});

const progressOffset = computed(() => {
  return circumference.value - (percentage.value / 100) * circumference.value;
});

const progressColor = computed(() => {
  const pct = percentage.value;
  if (pct >= 90) return '#16a34a'; // green-600
  if (pct >= 70) return '#65a30d'; // lime-600
  if (pct >= 50) return '#ca8a04'; // yellow-600
  if (pct >= 30) return '#ea580c'; // orange-600
  return '#dc2626'; // red-600
});

const sizeClass = computed(() => `size-${props.variant}`);
</script>

<style scoped>
.rating-progress-circle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.size-small {
  width: 80px;
  height: 80px;
}

.size-default {
  width: 120px;
  height: 120px;
}

.size-large {
  width: 160px;
  height: 160px;
}

.progress-svg {
  position: absolute;
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.progress-bg {
  stroke: #e5e7eb;
}

.progress-bar {
  transition: stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease;
}

.progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.progress-value {
  font-weight: 700;
  color: #1f2937;
}

.size-small .progress-value {
  font-size: 1rem;
}

.size-default .progress-value {
  font-size: 1.5rem;
}

.size-large .progress-value {
  font-size: 2rem;
}

.progress-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 2px;
}

.size-small .progress-label {
  font-size: 0.625rem;
}

.size-large .progress-label {
  font-size: 0.875rem;
}

.progress-count {
  font-size: 0.625rem;
  color: #9ca3af;
  margin-top: 1px;
}

.size-default .progress-count {
  font-size: 0.75rem;
}

.size-large .progress-count {
  font-size: 0.875rem;
}
</style>
