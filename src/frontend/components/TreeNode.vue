<template>
  <div class="tree-node">
    <!-- Node card -->
    <div 
      class="node-card p-3 bg-white border-2 rounded-lg shadow-sm min-w-[200px] max-w-[280px]"
      :class="nodeCardClass"
    >
      <!-- Node header -->
      <div class="flex items-center justify-between mb-2">
        <span class="badge badge-sm" :class="nodeTypeBadgeClass">
          {{ node.type === 'decision' ? 'Entscheidung' : 'Ergebnis' }}
        </span>
        
        <div v-if="editable" class="flex gap-1">
          <button class="btn btn-ghost btn-xs" @click="toggleEdit">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button 
            v-if="!isRoot" 
            class="btn btn-ghost btn-xs text-error"
            @click="handleDelete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Decision node content -->
      <template v-if="node.type === 'decision'">
        <div v-if="!isEditing" class="text-sm">
          <div class="font-medium text-gray-900 mb-1">
            {{ node.question || node.criterionKey }}
          </div>
          <div class="text-xs text-gray-500">
            Kriterium: {{ node.criterionKey }}
          </div>
        </div>
        
        <div v-else class="space-y-2">
          <select 
            class="select select-bordered select-xs w-full"
            :value="editData.criterionKey"
            @change="editData.criterionKey = $event.target.value"
          >
            <option value="">Kriterium wählen...</option>
            <option 
              v-for="def in criteriaDefinitions" 
              :key="def.key" 
              :value="def.key"
            >
              {{ def.display_name || def.key }}
            </option>
          </select>
          <input 
            type="text"
            class="input input-bordered input-xs w-full"
            placeholder="Frage..."
            :value="editData.question"
            @input="editData.question = $event.target.value"
          />
          <div class="flex justify-end gap-1">
            <button class="btn btn-ghost btn-xs" @click="cancelEdit">Abbrechen</button>
            <button class="btn btn-primary btn-xs" @click="saveEdit">Speichern</button>
          </div>
        </div>
      </template>
      
      <!-- Leaf node content -->
      <template v-else-if="node.type === 'leaf'">
        <div v-if="!isEditing" class="flex items-center gap-2">
          <RatingBadge :rating="leafRating" size="sm" showLabel />
        </div>
        
        <div v-else class="space-y-2">
          <select 
            class="select select-bordered select-xs w-full"
            :value="editData.rating"
            @change="editData.rating = $event.target.value"
          >
            <option value="dark_green">Dunkelgrün</option>
            <option value="light_green">Hellgrün</option>
            <option value="yellow">Gelb</option>
            <option value="orange">Orange</option>
            <option value="red">Rot</option>
          </select>
          <div class="flex justify-end gap-1">
            <button class="btn btn-ghost btn-xs" @click="cancelEdit">Abbrechen</button>
            <button class="btn btn-primary btn-xs" @click="saveEdit">Speichern</button>
          </div>
        </div>
      </template>
    </div>
    
    <!-- Branches (for decision nodes) -->
    <div v-if="node.type === 'decision' && node.branches?.length > 0" class="branches mt-4">
      <div class="flex justify-center gap-8">
        <div 
          v-for="(branch, index) in node.branches" 
          :key="index"
          class="branch flex flex-col items-center"
        >
          <!-- Branch connector -->
          <div class="connector w-0.5 h-4 bg-gray-300" />
          
          <!-- Branch label -->
          <div class="branch-label text-xs bg-gray-100 px-2 py-1 rounded mb-2">
            {{ branch.label || formatCondition(branch.condition) }}
          </div>
          
          <!-- Branch connector down -->
          <div class="connector w-0.5 h-4 bg-gray-300" />
          
          <!-- Child node -->
          <TreeNode
            v-if="branch.targetNodeId && nodes[branch.targetNodeId]"
            :node="nodes[branch.targetNodeId]"
            :nodes="nodes"
            :editable="editable"
            :criteria-definitions="criteriaDefinitions"
            @update-node="$emit('update-node', $event.nodeId, $event.updates)"
            @delete-node="$emit('delete-node', $event)"
            @add-branch="$emit('add-branch', $event.nodeId, $event.branch)"
            @update-branch="$emit('update-branch', $event.nodeId, $event.branchIndex, $event.updates)"
            @delete-branch="$emit('delete-branch', $event.nodeId, $event.branchIndex)"
          />
          
          <div v-else class="text-xs text-red-500 p-2 border border-dashed border-red-300 rounded">
            Fehlender Knoten: {{ branch.targetNodeId }}
          </div>
        </div>
      </div>
      
      <!-- Add branch button -->
      <div v-if="editable" class="flex justify-center mt-4">
        <button class="btn btn-ghost btn-xs" @click="handleAddBranch">
          + Zweig hinzufügen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import RatingBadge from './RatingBadge.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  nodes: {
    type: Object,
    required: true
  },
  editable: {
    type: Boolean,
    default: false
  },
  criteriaDefinitions: {
    type: Array,
    default: () => []
  },
  isRoot: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update-node', 'delete-node', 'add-branch', 'update-branch', 'delete-branch']);

// State
const isEditing = ref(false);
const editData = ref({});

// Computed
const nodeCardClass = computed(() => {
  if (props.node.type === 'leaf') {
    const rating = props.node.ratingFunction?.rating;
    switch (rating) {
      case 'dark_green': return 'border-emerald-500';
      case 'light_green': return 'border-green-400';
      case 'yellow': return 'border-yellow-400';
      case 'orange': return 'border-orange-400';
      case 'red': return 'border-red-400';
      default: return 'border-gray-300';
    }
  }
  return 'border-blue-400';
});

const nodeTypeBadgeClass = computed(() => {
  return props.node.type === 'decision' ? 'badge-info' : 'badge-success';
});

const leafRating = computed(() => {
  if (props.node.type !== 'leaf') return null;
  return props.node.ratingFunction?.rating || null;
});

// Methods
function toggleEdit() {
  if (isEditing.value) {
    cancelEdit();
  } else {
    startEdit();
  }
}

function startEdit() {
  if (props.node.type === 'decision') {
    editData.value = {
      criterionKey: props.node.criterionKey || '',
      question: props.node.question || ''
    };
  } else {
    editData.value = {
      rating: props.node.ratingFunction?.rating || 'yellow'
    };
  }
  isEditing.value = true;
}

function cancelEdit() {
  isEditing.value = false;
  editData.value = {};
}

function saveEdit() {
  if (props.node.type === 'decision') {
    emit('update-node', props.node.id, {
      criterionKey: editData.value.criterionKey,
      question: editData.value.question
    });
  } else {
    emit('update-node', props.node.id, {
      ratingFunction: {
        type: 'direct_mapping',
        rating: editData.value.rating
      }
    });
  }
  isEditing.value = false;
}

function handleDelete() {
  if (confirm('Diesen Knoten wirklich löschen?')) {
    emit('delete-node', props.node.id);
  }
}

function handleAddBranch() {
  const newNodeId = `node_${Date.now()}`;
  
  // First add the new node
  emit('update-node', newNodeId, {
    id: newNodeId,
    type: 'leaf',
    ratingFunction: {
      type: 'direct_mapping',
      rating: 'yellow'
    }
  });
  
  // Then add branch pointing to it
  emit('add-branch', props.node.id, {
    condition: { type: 'equals', value: null },
    label: 'Neuer Zweig',
    targetNodeId: newNodeId
  });
}

function formatCondition(condition) {
  if (!condition) return '?';
  
  switch (condition.type) {
    case 'equals':
      if (condition.value === true) return 'Ja';
      if (condition.value === false) return 'Nein';
      return `= ${condition.value}`;
    case 'not_equals':
      return `≠ ${condition.value}`;
    case 'greater_than':
      return `> ${condition.value}`;
    case 'greater_than_or_equals':
      return `≥ ${condition.value}`;
    case 'less_than':
      return `< ${condition.value}`;
    case 'less_than_or_equals':
      return `≤ ${condition.value}`;
    case 'between':
      return `${condition.min} - ${condition.max}`;
    default:
      return condition.type;
  }
}
</script>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.node-card {
  transition: all 0.2s ease;
}

.node-card:hover {
  @apply shadow-md;
}

.branches {
  position: relative;
}

.branch {
  position: relative;
}
</style>
