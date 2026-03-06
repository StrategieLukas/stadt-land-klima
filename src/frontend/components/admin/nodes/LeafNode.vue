<template>
  <div 
    class="leaf-node px-4 py-3 rounded-lg border-2 shadow-sm min-w-[140px]"
    :class="[getRatingClass(), { 'ring-2 ring-offset-2': selected }]"
    :style="{ '--ring-color': getRingColor() }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 flex items-center justify-center rounded" :class="getIconBgClass()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span class="text-xs font-medium" :class="getLabelClass()">Ergebnis</span>
      </div>
      <button
        @click.stop="$emit('delete')"
        class="p-1 text-gray-400 hover:text-red-500 rounded"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- Rating Display -->
    <div class="text-center">
      <div class="text-2xl mb-1">{{ getRatingEmoji() }}</div>
      <div class="text-sm font-medium" :class="getTextClass()">
        {{ data.label || getRatingLabel() }}
      </div>
    </div>
    
    <!-- Connection handle -->
    <Handle type="target" :position="Position.Top" :class="getHandleClass()" />
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core';

const props = defineProps({
  id: String,
  data: {
    type: Object,
    default: () => ({})
  },
  selected: Boolean
});

defineEmits(['update', 'delete']);

function getRatingClass() {
  const rating = props.data.rating || 'yellow';
  const classes = {
    dark_green: 'border-green-500 bg-green-50',
    light_green: 'border-lime-400 bg-lime-50',
    yellow: 'border-yellow-400 bg-yellow-50',
    orange: 'border-orange-400 bg-orange-50',
    red: 'border-red-500 bg-red-50'
  };
  return classes[rating] || classes.yellow;
}

function getRingColor() {
  const rating = props.data.rating || 'yellow';
  const colors = {
    dark_green: '#22c55e',
    light_green: '#a3e635',
    yellow: '#facc15',
    orange: '#fb923c',
    red: '#ef4444'
  };
  return colors[rating] || colors.yellow;
}

function getIconBgClass() {
  const rating = props.data.rating || 'yellow';
  const classes = {
    dark_green: 'bg-green-100 text-green-600',
    light_green: 'bg-lime-100 text-lime-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600'
  };
  return classes[rating] || classes.yellow;
}

function getLabelClass() {
  const rating = props.data.rating || 'yellow';
  const classes = {
    dark_green: 'text-green-600',
    light_green: 'text-lime-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600'
  };
  return classes[rating] || classes.yellow;
}

function getTextClass() {
  const rating = props.data.rating || 'yellow';
  const classes = {
    dark_green: 'text-green-700',
    light_green: 'text-lime-700',
    yellow: 'text-yellow-700',
    orange: 'text-orange-700',
    red: 'text-red-700'
  };
  return classes[rating] || classes.yellow;
}

function getHandleClass() {
  const rating = props.data.rating || 'yellow';
  const classes = {
    dark_green: '!bg-green-500',
    light_green: '!bg-lime-400',
    yellow: '!bg-yellow-400',
    orange: '!bg-orange-400',
    red: '!bg-red-500'
  };
  return classes[rating] || classes.yellow;
}

function getRatingEmoji() {
  const rating = props.data.rating || 'yellow';
  const emojis = {
    dark_green: '🟢',
    light_green: '🟢',
    yellow: '🟡',
    orange: '🟠',
    red: '🔴'
  };
  return emojis[rating] || '🟡';
}

function getRatingLabel() {
  const rating = props.data.rating || 'yellow';
  const labels = {
    dark_green: 'Dunkelgrün',
    light_green: 'Hellgrün',
    yellow: 'Gelb',
    orange: 'Orange',
    red: 'Rot'
  };
  return labels[rating] || 'Gelb';
}
</script>

<style scoped>
.leaf-node {
  cursor: pointer;
  transition: all 0.15s ease;
}

.leaf-node:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.leaf-node.ring-2 {
  --tw-ring-color: var(--ring-color);
}
</style>
