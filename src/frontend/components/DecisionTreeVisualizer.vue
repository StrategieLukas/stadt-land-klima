<template>
  <div class="decision-tree-visualizer">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold">{{ $t('rating.tree.title') }}</h3>
      <div class="flex items-center gap-2">
        <button 
          v-if="editable"
          class="btn btn-sm btn-outline"
          @click="addNewNode"
        >
          {{ $t('rating.tree.add_node') }}
        </button>
        <button 
          class="btn btn-sm"
          :class="{ 'btn-primary': showTestPanel }"
          @click="showTestPanel = !showTestPanel"
        >
          {{ $t('rating.tree.test') }}
        </button>
      </div>
    </div>
    
    <!-- Validation errors -->
    <div v-if="validationErrors.length > 0" class="alert alert-warning mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <div class="font-medium">{{ $t('rating.tree.validation_errors') }}:</div>
        <ul class="list-disc list-inside text-sm">
          <li v-for="err in validationErrors" :key="err">{{ err }}</li>
        </ul>
      </div>
    </div>
    
    <!-- Test panel -->
    <div v-if="showTestPanel" class="mb-4 p-4 bg-blue-50 rounded-lg">
      <h4 class="font-medium mb-3">{{ $t('rating.tree.test_panel') }}</h4>
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div 
          v-for="criterionKey in usedCriterionKeys" 
          :key="criterionKey"
          class="flex items-center gap-2"
        >
          <label class="text-sm font-medium min-w-[120px]">{{ criterionKey }}:</label>
          <input 
            type="text"
            class="input input-bordered input-sm flex-1"
            :value="testValues[criterionKey]"
            @input="testValues[criterionKey] = parseTestValue($event.target.value)"
          />
        </div>
      </div>
      
      <button class="btn btn-sm btn-primary" @click="runTest">
        {{ $t('rating.tree.run_test') }}
      </button>
      
      <div v-if="testResult" class="mt-4 p-3 bg-white rounded border">
        <div class="flex items-center gap-2 mb-2">
          <span class="font-medium">{{ $t('rating.tree.test_result') }}:</span>
          <RatingBadge :rating="testResult.rating" showLabel />
        </div>
        <DecisionPathVisualizer :path="testResult.path" />
      </div>
    </div>
    
    <!-- Tree visualization -->
    <div class="tree-container overflow-auto max-h-[600px] p-4 bg-gray-50 rounded-lg">
      <div v-if="!tree || !tree.nodes || Object.keys(tree.nodes).length === 0" class="text-center py-8 text-gray-500">
        {{ $t('rating.tree.empty') }}
      </div>
      
      <div v-else class="tree-wrapper">
        <TreeNode
          v-if="rootNode"
          :node="rootNode"
          :nodes="tree.nodes"
          :editable="editable"
          :criteria-definitions="criteriaDefinitions"
          @update-node="handleUpdateNode"
          @delete-node="handleDeleteNode"
          @add-branch="handleAddBranch"
          @update-branch="handleUpdateBranch"
          @delete-branch="handleDeleteBranch"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import ratingEngine from '~/shared/ratingEngine';
import RatingBadge from './RatingBadge.vue';
import DecisionPathVisualizer from './DecisionPathVisualizer.vue';
import TreeNode from './TreeNode.vue';

const props = defineProps({
  tree: {
    type: Object,
    default: null
  },
  criteriaDefinitions: {
    type: Array,
    default: () => []
  },
  editable: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:tree', 'node-updated', 'node-deleted', 'branch-added', 'branch-updated', 'branch-deleted']);

// State
const showTestPanel = ref(false);
const testValues = ref({});
const testResult = ref(null);
const validationErrors = ref([]);

// Computed
const rootNode = computed(() => {
  if (!props.tree?.nodes || !props.tree.rootNodeId) return null;
  return props.tree.nodes[props.tree.rootNodeId];
});

const usedCriterionKeys = computed(() => {
  if (!props.tree?.nodes) return [];
  
  const keys = new Set();
  for (const node of Object.values(props.tree.nodes)) {
    if (node.type === 'decision' && node.criterionKey) {
      keys.add(node.criterionKey);
    }
  }
  return Array.from(keys);
});

// Methods
function parseTestValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '') return null;
  const num = Number(value);
  return isNaN(num) ? value : num;
}

function runTest() {
  if (!props.tree) return;
  testResult.value = ratingEngine.traverseDecisionTree(props.tree, testValues.value);
}

function validateTree() {
  if (!props.tree) {
    validationErrors.value = [];
    return;
  }
  const result = ratingEngine.validateDecisionTree(props.tree);
  validationErrors.value = result.errors;
}

function addNewNode() {
  const nodeId = `node_${Date.now()}`;
  
  emit('node-updated', nodeId, {
    id: nodeId,
    type: 'leaf',
    ratingFunction: {
      type: 'direct_mapping',
      rating: 'yellow'
    }
  });
}

function handleUpdateNode(nodeId, updates) {
  emit('node-updated', nodeId, updates);
}

function handleDeleteNode(nodeId) {
  emit('node-deleted', nodeId);
}

function handleAddBranch(nodeId, branch) {
  emit('branch-added', nodeId, branch);
}

function handleUpdateBranch(nodeId, branchIndex, updates) {
  emit('branch-updated', nodeId, branchIndex, updates);
}

function handleDeleteBranch(nodeId, branchIndex) {
  emit('branch-deleted', nodeId, branchIndex);
}

// Watch tree changes and validate
watch(() => props.tree, () => {
  validateTree();
  // Reset test when tree changes
  testResult.value = null;
}, { deep: true, immediate: true });
</script>

<style scoped>
.decision-tree-visualizer {
  @apply bg-white border rounded-lg p-4;
}

.tree-container {
  min-height: 200px;
}

.tree-wrapper {
  display: flex;
  justify-content: center;
}
</style>
