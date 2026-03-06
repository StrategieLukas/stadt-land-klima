<template>
  <div 
    class="decision-node px-4 py-3 rounded-lg border-2 border-blue-400 bg-white shadow-sm min-w-[180px]"
    :class="{ 'ring-2 ring-blue-500': selected }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span class="text-xs font-medium text-blue-600">Entscheidung</span>
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
    
    <!-- Criterion Display -->
    <div class="text-sm font-medium text-gray-900 mb-2">
      {{ data.label || 'Kriterium wählen' }}
    </div>
    
    <!-- Branches preview -->
    <div v-if="data.branches?.length" class="space-y-1 mt-2 pt-2 border-t">
      <div 
        v-for="(branch, idx) in data.branches.slice(0, 3)" 
        :key="idx"
        class="text-xs text-gray-500 flex items-center gap-1"
      >
        <span class="w-4 h-4 flex items-center justify-center bg-gray-100 rounded text-[10px]">
          {{ idx + 1 }}
        </span>
        <span>{{ formatCondition(branch.condition) }}</span>
      </div>
      <div v-if="data.branches.length > 3" class="text-xs text-gray-400">
        +{{ data.branches.length - 3 }} weitere
      </div>
    </div>
    
    <!-- Add branch button -->
    <button
      @click.stop="$emit('add-branch')"
      class="mt-2 w-full py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-300 flex items-center justify-center gap-1"
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Verzweigung
    </button>
    
    <!-- Connection handles -->
    <Handle type="target" :position="Position.Top" class="!bg-blue-500" />
    <Handle type="source" :position="Position.Bottom" class="!bg-blue-500" />
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
  criteria: {
    type: Array,
    default: () => []
  },
  selected: Boolean
});

defineEmits(['update', 'delete', 'add-branch']);

function formatCondition(condition) {
  if (!condition) return '?';
  const ops = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
  const value = condition.value;
  const displayValue = typeof value === 'boolean' ? (value ? 'Ja' : 'Nein') : (value ?? '?');
  return `${ops[condition.operator] || '='} ${displayValue}`;
}
</script>

<style scoped>
.decision-node {
  cursor: pointer;
  transition: all 0.15s ease;
}

.decision-node:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
