<template>
  <div class="decision-tree-editor">
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-4 pb-4 border-b">
      <div class="flex items-center gap-2">
        <button
          @click="addDecisionNode"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Entscheidung
        </button>
        <button
          @click="addLeafNode"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Ergebnis
        </button>
        <button
          @click="autoLayout"
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          title="Auto-Layout"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="hasChanges"
          @click="saveTree"
          class="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Speichern
        </button>
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Schließen
        </button>
      </div>
    </div>

    <!-- VueFlow Canvas -->
    <div class="vue-flow-wrapper" style="height: 500px;">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-viewport="{ zoom: 0.8, x: 50, y: 50 }"
        :fit-view-on-init="true"
        :nodes-draggable="true"
        :nodes-connectable="true"
        :connection-mode="ConnectionMode.Loose"
        @node-click="onNodeClick"
        @connect="onConnect"
        @edges-change="onEdgesChange"
        @nodes-change="onNodesChange"
      >
        <template #node-decision="{ data, id }">
          <DecisionNodeComponent
            :id="id"
            :data="data"
            :criteria="criteriaDefinitions"
            @update="updateNodeData(id, $event)"
            @delete="deleteNode(id)"
            @add-branch="addBranch(id)"
          />
        </template>
        <template #node-leaf="{ data, id }">
          <LeafNodeComponent
            :id="id"
            :data="data"
            @update="updateNodeData(id, $event)"
            @delete="deleteNode(id)"
          />
        </template>
        <Background />
        <Controls position="bottom-right" />
      </VueFlow>
    </div>

    <!-- Node Editor Panel (shows when node selected) -->
    <div v-if="selectedNode" class="mt-4 p-4 bg-gray-50 rounded-lg border">
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-medium text-gray-900">
          {{ selectedNode.type === 'decision' ? 'Entscheidungsknoten' : 'Ergebnisknoten' }}
        </h4>
        <button
          @click="selectedNode = null"
          class="p-1 text-gray-400 hover:text-gray-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Decision node editor -->
      <div v-if="selectedNode.type === 'decision'" class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Kriterium</label>
          <select
            :value="selectedNode.data.criterionKey"
            @change="updateSelectedNodeCriterion($event.target.value)"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Kriterium wählen --</option>
            <option 
              v-for="criterion in criteriaDefinitions" 
              :key="criterion.key"
              :value="criterion.key"
            >
              {{ criterion.display_name }} ({{ criterion.key }})
            </option>
          </select>
        </div>
        
        <!-- Branches -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700">Verzweigungen</label>
            <button
              @click="addBranchToSelected"
              class="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Hinzufügen
            </button>
          </div>
          <div 
            v-for="(branch, idx) in selectedNode.data.branches || []" 
            :key="idx"
            class="flex items-center gap-2 p-2 bg-white rounded border"
          >
            <select
              :value="branch.condition?.operator || 'eq'"
              @change="updateBranchCondition(idx, 'operator', $event.target.value)"
              class="px-2 py-1 text-sm border rounded"
            >
              <option value="eq">=</option>
              <option value="neq">≠</option>
              <option value="gt">&gt;</option>
              <option value="gte">≥</option>
              <option value="lt">&lt;</option>
              <option value="lte">≤</option>
            </select>
            <input
              :value="branch.condition?.value ?? ''"
              @input="updateBranchCondition(idx, 'value', $event.target.value)"
              type="text"
              class="flex-1 px-2 py-1 text-sm border rounded"
              placeholder="Wert"
            />
            <button
              @click="removeBranch(idx)"
              class="p-1 text-red-500 hover:text-red-700"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Leaf node editor -->
      <div v-else class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Bewertung</label>
          <select
            :value="selectedNode.data.rating"
            @change="updateSelectedNodeRating($event.target.value)"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="dark_green">🟢 Dunkelgrün (1.0)</option>
            <option value="light_green">🟢 Hellgrün (0.75)</option>
            <option value="yellow">🟡 Gelb (0.5)</option>
            <option value="orange">🟠 Orange (0.25)</option>
            <option value="red">🔴 Rot (0)</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- Instructions -->
    <div class="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
      <p class="font-medium mb-1">Anleitung:</p>
      <ul class="list-disc list-inside space-y-1 text-blue-700">
        <li>Klicken Sie auf einen Knoten, um ihn zu bearbeiten</li>
        <li>Ziehen Sie von einem Knoten zum anderen, um eine Verbindung herzustellen</li>
        <li>Der erste Knoten ist der Startpunkt (Root)</li>
        <li>Jeder Pfad muss mit einem Ergebnisknoten (Bewertung) enden</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, markRaw } from 'vue';
import { VueFlow, ConnectionMode } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

// Custom node components
import DecisionNodeComponent from './nodes/DecisionNode.vue';
import LeafNodeComponent from './nodes/LeafNode.vue';

const props = defineProps({
  treeStructure: {
    type: Object,
    default: null
  },
  criteriaDefinitions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['save', 'close']);

// VueFlow state
const nodes = ref([]);
const edges = ref([]);
const selectedNode = ref(null);
const hasChanges = ref(false);

// Convert tree structure to VueFlow nodes/edges on mount
onMounted(() => {
  if (props.treeStructure) {
    convertTreeToFlow(props.treeStructure);
  } else {
    // Create initial root node
    addDecisionNode();
  }
});

// Convert existing tree to VueFlow format
function convertTreeToFlow(tree) {
  if (!tree?.nodes || !tree?.rootNodeId) return;
  
  const flowNodes = [];
  const flowEdges = [];
  let y = 0;
  
  // Convert nodes
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    const isRoot = nodeId === tree.rootNodeId;
    
    flowNodes.push({
      id: nodeId,
      type: node.type === 'leaf' ? 'leaf' : 'decision',
      position: node.position || { x: isRoot ? 250 : Math.random() * 400, y: y },
      data: {
        criterionKey: node.criterionKey || '',
        branches: node.branches || [],
        rating: node.ratingFunction?.rating || 'yellow',
        label: node.type === 'leaf' 
          ? getRatingLabel(node.ratingFunction?.rating)
          : getCriterionLabel(node.criterionKey)
      }
    });
    y += 150;
  }
  
  // Convert branches to edges
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    if (node.branches) {
      node.branches.forEach((branch, idx) => {
        if (branch.targetNodeId) {
          flowEdges.push({
            id: `${nodeId}-${branch.targetNodeId}-${idx}`,
            source: nodeId,
            target: branch.targetNodeId,
            label: formatCondition(branch.condition),
            type: 'smoothstep'
          });
        }
      });
    }
  }
  
  nodes.value = flowNodes;
  edges.value = flowEdges;
}

// Convert VueFlow back to tree structure
function convertFlowToTree() {
  const tree = {
    nodes: {},
    rootNodeId: nodes.value.length > 0 ? nodes.value[0].id : null
  };
  
  for (const node of nodes.value) {
    const treeNode = {
      id: node.id,
      type: node.type === 'leaf' ? 'leaf' : 'decision',
      position: node.position
    };
    
    if (node.type === 'decision') {
      treeNode.criterionKey = node.data.criterionKey;
      treeNode.branches = [];
      
      // Find edges from this node
      const nodeEdges = edges.value.filter(e => e.source === node.id);
      for (const edge of nodeEdges) {
        const branch = node.data.branches?.find(b => b.targetNodeId === edge.target) || {};
        treeNode.branches.push({
          condition: branch.condition || { operator: 'eq', value: null },
          targetNodeId: edge.target
        });
      }
    } else {
      treeNode.ratingFunction = {
        type: 'direct_mapping',
        rating: node.data.rating || 'yellow'
      };
    }
    
    tree.nodes[node.id] = treeNode;
  }
  
  return tree;
}

// Add new decision node
function addDecisionNode() {
  const id = `decision_${Date.now()}`;
  nodes.value.push({
    id,
    type: 'decision',
    position: { x: 250, y: nodes.value.length * 150 },
    data: {
      criterionKey: '',
      branches: [],
      label: 'Neue Entscheidung'
    }
  });
  hasChanges.value = true;
}

// Add new leaf node
function addLeafNode() {
  const id = `leaf_${Date.now()}`;
  nodes.value.push({
    id,
    type: 'leaf',
    position: { x: 250, y: nodes.value.length * 150 },
    data: {
      rating: 'yellow',
      label: 'Gelb'
    }
  });
  hasChanges.value = true;
}

// Delete node
function deleteNode(nodeId) {
  nodes.value = nodes.value.filter(n => n.id !== nodeId);
  edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId);
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = null;
  }
  hasChanges.value = true;
}

// Update node data
function updateNodeData(nodeId, data) {
  const node = nodes.value.find(n => n.id === nodeId);
  if (node) {
    node.data = { ...node.data, ...data };
    hasChanges.value = true;
  }
}

// Node click handler
function onNodeClick({ node }) {
  selectedNode.value = node;
}

// Connection handler
function onConnect(connection) {
  edges.value.push({
    id: `${connection.source}-${connection.target}`,
    source: connection.source,
    target: connection.target,
    type: 'smoothstep'
  });
  hasChanges.value = true;
}

// Update selected node criterion
function updateSelectedNodeCriterion(criterionKey) {
  if (!selectedNode.value) return;
  const node = nodes.value.find(n => n.id === selectedNode.value.id);
  if (node) {
    node.data.criterionKey = criterionKey;
    node.data.label = getCriterionLabel(criterionKey);
    hasChanges.value = true;
  }
}

// Update selected node rating
function updateSelectedNodeRating(rating) {
  if (!selectedNode.value) return;
  const node = nodes.value.find(n => n.id === selectedNode.value.id);
  if (node) {
    node.data.rating = rating;
    node.data.label = getRatingLabel(rating);
    hasChanges.value = true;
  }
}

// Add branch to selected node
function addBranchToSelected() {
  if (!selectedNode.value || selectedNode.value.type !== 'decision') return;
  const node = nodes.value.find(n => n.id === selectedNode.value.id);
  if (node) {
    if (!node.data.branches) node.data.branches = [];
    node.data.branches.push({
      condition: { operator: 'eq', value: '' },
      targetNodeId: null
    });
    hasChanges.value = true;
  }
}

// Update branch condition
function updateBranchCondition(branchIdx, field, value) {
  if (!selectedNode.value) return;
  const node = nodes.value.find(n => n.id === selectedNode.value.id);
  if (node && node.data.branches?.[branchIdx]) {
    if (!node.data.branches[branchIdx].condition) {
      node.data.branches[branchIdx].condition = {};
    }
    
    // Parse value for numbers/booleans
    let parsedValue = value;
    if (field === 'value') {
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
    }
    
    node.data.branches[branchIdx].condition[field] = parsedValue;
    hasChanges.value = true;
  }
}

// Remove branch
function removeBranch(branchIdx) {
  if (!selectedNode.value) return;
  const node = nodes.value.find(n => n.id === selectedNode.value.id);
  if (node && node.data.branches) {
    // Also remove the corresponding edge
    const branch = node.data.branches[branchIdx];
    if (branch?.targetNodeId) {
      edges.value = edges.value.filter(e => 
        !(e.source === node.id && e.target === branch.targetNodeId)
      );
    }
    node.data.branches.splice(branchIdx, 1);
    hasChanges.value = true;
  }
}

// Auto layout nodes
function autoLayout() {
  const levelMap = new Map();
  const visited = new Set();
  
  // Find root node (first node or node with no incoming edges)
  const rootId = nodes.value[0]?.id;
  if (!rootId) return;
  
  // BFS to assign levels
  const queue = [{ id: rootId, level: 0 }];
  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    
    if (!levelMap.has(level)) levelMap.set(level, []);
    levelMap.get(level).push(id);
    
    // Find children
    const children = edges.value
      .filter(e => e.source === id)
      .map(e => e.target);
    
    children.forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }
  
  // Position nodes
  levelMap.forEach((nodeIds, level) => {
    const spacing = 200;
    const startX = (500 - (nodeIds.length - 1) * spacing) / 2;
    
    nodeIds.forEach((nodeId, idx) => {
      const node = nodes.value.find(n => n.id === nodeId);
      if (node) {
        node.position = {
          x: startX + idx * spacing,
          y: level * 150
        };
      }
    });
  });
  
  hasChanges.value = true;
}

// Helper functions
function getCriterionLabel(key) {
  const criterion = props.criteriaDefinitions.find(c => c.key === key);
  return criterion?.display_name || key || 'Kriterium wählen';
}

function getRatingLabel(rating) {
  const labels = {
    dark_green: '🟢 Dunkelgrün',
    light_green: '🟢 Hellgrün',
    yellow: '🟡 Gelb',
    orange: '🟠 Orange',
    red: '🔴 Rot'
  };
  return labels[rating] || 'Bewertung';
}

function formatCondition(condition) {
  if (!condition) return '';
  const ops = { eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤' };
  return `${ops[condition.operator] || '='} ${condition.value ?? '?'}`;
}

// Track changes
function onNodesChange(changes) {
  hasChanges.value = true;
}

function onEdgesChange(changes) {
  hasChanges.value = true;
}

// Save tree
function saveTree() {
  const tree = convertFlowToTree();
  emit('save', tree);
  hasChanges.value = false;
}
</script>

<style scoped>
.vue-flow-wrapper {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
}
</style>
