<template>
  <div class="decision-path-visualizer">
    <div v-if="path.length === 0" class="text-sm text-gray-500 italic">
      {{ $t('rating.decision_path.no_path') }}
    </div>
    
    <div v-else class="flex flex-col gap-2">
      <div 
        v-for="(node, index) in path" 
        :key="node.nodeId"
        class="flex items-start gap-3"
      >
        <!-- Connector line -->
        <div class="flex flex-col items-center">
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
            :class="getNodeCircleClass(node, index)"
          >
            {{ index + 1 }}
          </div>
          <div 
            v-if="index < path.length - 1" 
            class="w-0.5 h-6 bg-gray-300"
          />
        </div>
        
        <!-- Node content -->
        <div class="flex-1 pb-2">
          <!-- Decision node -->
          <template v-if="node.type === 'decision'">
            <div class="text-sm font-medium text-gray-900">
              {{ node.question || node.criterionKey }}
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-gray-500">{{ $t('rating.decision_path.answer') }}:</span>
              <span class="badge badge-sm badge-primary">{{ node.answer }}</span>
              <span v-if="node.value !== undefined" class="text-xs text-gray-400">
                ({{ formatValue(node.value) }})
              </span>
            </div>
          </template>
          
          <!-- Leaf node -->
          <template v-else-if="node.type === 'leaf'">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-900">
                {{ $t('rating.decision_path.result') }}:
              </span>
              <RatingBadge :rating="node.rating" showLabel />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import RatingBadge from './RatingBadge.vue';

const props = defineProps({
  path: {
    type: Array,
    default: () => []
  }
});

function getNodeCircleClass(node, index) {
  const isLast = index === props.path.length - 1;
  
  if (node.type === 'leaf') {
    // Color based on rating
    switch (node.rating) {
      case 'dark_green':
        return 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500';
      case 'light_green':
        return 'bg-green-100 text-green-700 border-2 border-green-500';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500';
      case 'orange':
        return 'bg-orange-100 text-orange-700 border-2 border-orange-500';
      case 'red':
        return 'bg-red-100 text-red-700 border-2 border-red-500';
      default:
        return 'bg-gray-100 text-gray-700 border-2 border-gray-400';
    }
  }
  
  return 'bg-blue-100 text-blue-700 border-2 border-blue-400';
}

function formatValue(value) {
  if (value === true) return 'Ja';
  if (value === false) return 'Nein';
  if (value === null || value === undefined) return '-';
  return String(value);
}
</script>

<style scoped>
.decision-path-visualizer {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
}
</style>
