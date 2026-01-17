/**
 * Decision Tree Composable
 * 
 * Provides functionality for loading, editing, and visualizing decision trees
 * for measure rating calculation.
 */

import { ref, computed } from 'vue';
import { createDirectus, rest, readItem, readItems, updateItem, createItem } from '@directus/sdk';
import { useRuntimeConfig } from '#app';
import { useAuthStore } from '~/stores/auth';
import ratingEngine from '~/shared/ratingEngine';

/**
 * Create a Directus client with auth token
 */
function useDirectusClient() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  const baseUrl = process.client 
    ? config.public.clientDirectusUrl 
    : config.public.serverDirectusUrl;
  
  const client = createDirectus(baseUrl || 'http://localhost:8055').with(rest());
  
  // Note: accessToken is a readonly ref, so we need to access .value
  const token = authStore.accessToken?.value;
  if (token) {
    client.setToken(token);
  }
  
  return client;
}

/**
 * Composable for managing decision trees
 * @param {string} measureId - The measure ID (optional)
 */
export function useDecisionTree(measureId = null) {
  const client = useDirectusClient();
  
  // State
  const trees = ref([]);
  const activeTree = ref(null);
  const editingTree = ref(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref(null);
  const validationErrors = ref([]);
  
  // Computed
  const hasActiveTree = computed(() => !!activeTree.value);
  
  const isValid = computed(() => {
    if (!editingTree.value?.tree_structure) return false;
    const result = ratingEngine.validateDecisionTree(editingTree.value.tree_structure);
    return result.valid;
  });
  
  const treeNodes = computed(() => {
    if (!editingTree.value?.tree_structure?.nodes) return [];
    return Object.values(editingTree.value.tree_structure.nodes);
  });
  
  const leafNodes = computed(() => {
    return treeNodes.value.filter(n => n.type === 'leaf');
  });
  
  const decisionNodes = computed(() => {
    return treeNodes.value.filter(n => n.type === 'decision');
  });
  
  // Methods
  async function loadTrees() {
    if (!measureId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const data = await client.request(
        readItems('decision_trees', {
          filter: { measure_id: { _eq: measureId } },
          fields: ['*'],
          sort: ['-version']
        })
      );
      
      trees.value = data;
      activeTree.value = data.find(t => t.status === 'active') || null;
      
    } catch (err) {
      error.value = err.message || 'Failed to load decision trees';
      console.error('Failed to load decision trees:', err);
    } finally {
      loading.value = false;
    }
  }
  
  async function loadTree(treeId) {
    loading.value = true;
    error.value = null;
    
    try {
      const data = await client.request(
        readItem('decision_trees', treeId, {
          fields: ['*']
        })
      );
      
      editingTree.value = data;
      return data;
      
    } catch (err) {
      error.value = err.message || 'Failed to load decision tree';
      console.error('Failed to load decision tree:', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Create a new decision tree for the measure
   * @param {string} name - Tree name
   * @param {string} description - Tree description
   */
  async function createTree(name, description = '') {
    if (!measureId) {
      error.value = 'Measure ID is required';
      return;
    }
    
    saving.value = true;
    error.value = null;
    
    try {
      // Calculate next version
      const maxVersion = Math.max(0, ...trees.value.map(t => t.version || 0));
      
      const newTree = await client.request(
        createItem('decision_trees', {
          measure_id: measureId,
          name,
          description,
          version: maxVersion + 1,
          status: 'draft',
          tree_structure: {
            rootNodeId: 'root',
            nodes: {
              root: {
                id: 'root',
                type: 'decision',
                criterionKey: '',
                question: 'Erstes Entscheidungskriterium',
                branches: [
                  {
                    condition: { type: 'equals', value: true },
                    label: 'Ja',
                    targetNodeId: 'yes_leaf'
                  },
                  {
                    condition: { type: 'equals', value: false },
                    label: 'Nein',
                    targetNodeId: 'no_leaf'
                  }
                ]
              },
              yes_leaf: {
                id: 'yes_leaf',
                type: 'leaf',
                ratingFunction: {
                  type: 'direct_mapping',
                  rating: 'dark_green'
                }
              },
              no_leaf: {
                id: 'no_leaf',
                type: 'leaf',
                ratingFunction: {
                  type: 'direct_mapping',
                  rating: 'red'
                }
              }
            }
          }
        })
      );
      
      trees.value.unshift(newTree);
      editingTree.value = newTree;
      
      return newTree;
      
    } catch (err) {
      error.value = err.message || 'Failed to create decision tree';
      console.error('Failed to create decision tree:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Save changes to the editing tree
   */
  async function saveTree() {
    if (!editingTree.value?.id) return;
    
    // Validate first
    const validation = validate();
    if (!validation.valid) {
      error.value = 'Decision tree has validation errors';
      return;
    }
    
    saving.value = true;
    error.value = null;
    
    try {
      const updated = await client.request(
        updateItem('decision_trees', editingTree.value.id, {
          name: editingTree.value.name,
          description: editingTree.value.description,
          tree_structure: editingTree.value.tree_structure
        })
      );
      
      // Update in list
      const index = trees.value.findIndex(t => t.id === updated.id);
      if (index !== -1) {
        trees.value[index] = updated;
      }
      
      editingTree.value = updated;
      return updated;
      
    } catch (err) {
      error.value = err.message || 'Failed to save decision tree';
      console.error('Failed to save decision tree:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Activate a decision tree (deactivates others)
   * @param {string} treeId - The tree ID to activate
   */
  async function activateTree(treeId) {
    saving.value = true;
    error.value = null;
    
    try {
      // First, deactivate currently active tree
      if (activeTree.value && activeTree.value.id !== treeId) {
        await client.request(
          updateItem('decision_trees', activeTree.value.id, {
            status: 'archived'
          })
        );
      }
      
      // Activate the new tree
      const activated = await client.request(
        updateItem('decision_trees', treeId, {
          status: 'active'
        })
      );
      
      // Update local state
      activeTree.value = activated;
      
      // Update in list
      trees.value = trees.value.map(t => ({
        ...t,
        status: t.id === treeId ? 'active' : (t.status === 'active' ? 'archived' : t.status)
      }));
      
      return activated;
      
    } catch (err) {
      error.value = err.message || 'Failed to activate decision tree';
      console.error('Failed to activate decision tree:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Validate the editing tree
   */
  function validate() {
    if (!editingTree.value?.tree_structure) {
      validationErrors.value = ['No tree structure'];
      return { valid: false, errors: validationErrors.value };
    }
    
    const result = ratingEngine.validateDecisionTree(editingTree.value.tree_structure);
    validationErrors.value = result.errors;
    return result;
  }
  
  /**
   * Add a new node to the tree
   * @param {string} nodeId - Unique node ID
   * @param {Object} nodeConfig - Node configuration
   */
  function addNode(nodeId, nodeConfig) {
    if (!editingTree.value?.tree_structure?.nodes) return;
    
    editingTree.value.tree_structure.nodes[nodeId] = {
      id: nodeId,
      ...nodeConfig
    };
  }
  
  /**
   * Update an existing node
   * @param {string} nodeId - Node ID to update
   * @param {Object} updates - Partial node updates
   */
  function updateNode(nodeId, updates) {
    if (!editingTree.value?.tree_structure?.nodes?.[nodeId]) return;
    
    Object.assign(editingTree.value.tree_structure.nodes[nodeId], updates);
  }
  
  /**
   * Remove a node from the tree
   * @param {string} nodeId - Node ID to remove
   */
  function removeNode(nodeId) {
    if (!editingTree.value?.tree_structure?.nodes?.[nodeId]) return;
    if (nodeId === editingTree.value.tree_structure.rootNodeId) {
      error.value = 'Cannot remove root node';
      return;
    }
    
    delete editingTree.value.tree_structure.nodes[nodeId];
    
    // Also remove any branches pointing to this node
    for (const node of Object.values(editingTree.value.tree_structure.nodes)) {
      if (node.branches) {
        node.branches = node.branches.filter(b => b.targetNodeId !== nodeId);
      }
    }
  }
  
  /**
   * Add a branch to a decision node
   * @param {string} nodeId - Decision node ID
   * @param {Object} branch - Branch configuration
   */
  function addBranch(nodeId, branch) {
    const node = editingTree.value?.tree_structure?.nodes?.[nodeId];
    if (!node || node.type !== 'decision') return;
    
    if (!node.branches) {
      node.branches = [];
    }
    
    node.branches.push(branch);
  }
  
  /**
   * Update a branch on a decision node
   * @param {string} nodeId - Decision node ID
   * @param {number} branchIndex - Branch index
   * @param {Object} updates - Partial branch updates
   */
  function updateBranch(nodeId, branchIndex, updates) {
    const node = editingTree.value?.tree_structure?.nodes?.[nodeId];
    if (!node?.branches?.[branchIndex]) return;
    
    Object.assign(node.branches[branchIndex], updates);
  }
  
  /**
   * Remove a branch from a decision node
   * @param {string} nodeId - Decision node ID
   * @param {number} branchIndex - Branch index
   */
  function removeBranch(nodeId, branchIndex) {
    const node = editingTree.value?.tree_structure?.nodes?.[nodeId];
    if (!node?.branches) return;
    
    node.branches.splice(branchIndex, 1);
  }
  
  /**
   * Test the tree with sample criteria values
   * @param {Object} criteriaMap - Map of criterion key -> value
   * @returns {Object} { rating, path }
   */
  function testTree(criteriaMap) {
    if (!editingTree.value?.tree_structure) {
      return { rating: null, path: [] };
    }
    
    return ratingEngine.traverseDecisionTree(
      editingTree.value.tree_structure,
      criteriaMap
    );
  }
  
  /**
   * Generate a unique node ID
   * @param {string} prefix - ID prefix
   */
  function generateNodeId(prefix = 'node') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  return {
    // State
    trees,
    activeTree,
    editingTree,
    loading,
    saving,
    error,
    validationErrors,
    
    // Computed
    hasActiveTree,
    isValid,
    treeNodes,
    leafNodes,
    decisionNodes,
    
    // Methods
    loadTrees,
    loadTree,
    createTree,
    saveTree,
    activateTree,
    validate,
    addNode,
    updateNode,
    removeNode,
    addBranch,
    updateBranch,
    removeBranch,
    testTree,
    generateNodeId
  };
}

export default useDecisionTree;
