<template>
  <div 
    class="bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md"
    :class="{ 
      'border-green-300 bg-green-50/50': measure.status === 'published',
      'border-yellow-300 bg-yellow-50/50': measure.status === 'draft'
    }"
    @click="$emit('click', measure)"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-sm font-bold text-gray-700">
            {{ measure.measure_id }}
          </span>
          <span 
            class="px-2 py-0.5 text-xs rounded-full"
            :class="measure.status === 'published' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-yellow-100 text-yellow-700'"
          >
            {{ measure.status === 'published' ? 'Veröffentlicht' : 'Entwurf' }}
          </span>
        </div>
        <h4 class="font-medium text-gray-900 line-clamp-1">
          {{ measure.name }}
        </h4>
        <p v-if="measure.description" class="text-sm text-gray-500 mt-1 line-clamp-2">
          {{ stripHtml(measure.description) }}
        </p>
      </div>
      
      <div class="flex items-center gap-2 shrink-0">
        <!-- Weight badge -->
        <span 
          v-if="measure.weight"
          class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
          title="Gewichtung"
        >
          {{ measure.weight }}x
        </span>
        
        <!-- Edit button -->
        <button
          v-if="canEdit"
          @click.stop="$emit('edit', measure)"
          class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Bearbeiten"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  measure: {
    type: Object,
    required: true
  },
  canEdit: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click', 'edit']);

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').substring(0, 200);
}
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
