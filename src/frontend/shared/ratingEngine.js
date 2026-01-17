/**
 * Rating Engine Library
 * 
 * This module provides the core rating calculation logic for the measure rating system.
 * It handles decision tree traversal and various rating function types.
 * 
 * Rating Levels (in order of quality):
 * - dark_green (1.0): Best/highest rating
 * - light_green (0.75): Good rating
 * - yellow (0.5): Moderate rating
 * - orange (0.25): Below average rating  
 * - red (0.0): Lowest/worst rating
 * 
 * Criteria Types:
 * - quantitative: Numeric values (e.g., percentage, count, year)
 * - categorical: Enum values from predefined options
 * - logical: Boolean true/false values
 * 
 * Rating Function Types:
 * - direct_mapping: Map criteria directly to rating
 * - quantity_map: Map numeric ranges to ratings
 * - logical_combinations: Combine multiple boolean criteria
 * - quality_fulfillment: Check quality of implementation
 */

// Rating level constants
export const RATING_LEVELS = {
  DARK_GREEN: 'dark_green',
  LIGHT_GREEN: 'light_green',
  YELLOW: 'yellow',
  ORANGE: 'orange',
  RED: 'red'
};

// Map rating levels to numeric values (for calculations and sorting)
export const RATING_VALUES = {
  dark_green: 1.0,
  light_green: 0.75,
  yellow: 0.5,
  orange: 0.25,
  red: 0.0
};

// Reverse map: numeric value to rating level
export const VALUE_TO_RATING = {
  1.0: 'dark_green',
  0.75: 'light_green',
  0.5: 'yellow',
  0.25: 'orange',
  0.0: 'red'
};

// Rating level display info (for UI)
export const RATING_DISPLAY = {
  dark_green: {
    label: 'Dunkelgrün',
    labelEn: 'Dark Green',
    color: '#065F46',
    bgColor: '#D1FAE5',
    icon: 4
  },
  light_green: {
    label: 'Hellgrün',
    labelEn: 'Light Green', 
    color: '#10B981',
    bgColor: '#ECFDF5',
    icon: 3
  },
  yellow: {
    label: 'Gelb',
    labelEn: 'Yellow',
    color: '#FBBF24',
    bgColor: '#FEF3C7',
    icon: 2
  },
  orange: {
    label: 'Orange',
    labelEn: 'Orange',
    color: '#F97316',
    bgColor: '#FED7AA',
    icon: 1
  },
  red: {
    label: 'Rot',
    labelEn: 'Red',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    icon: 0
  }
};

/**
 * Get the effective rating (considering manual override)
 * @param {Object} ratingMeasure - The ratings_measures record
 * @returns {string|null} The effective rating level
 */
export function getEffectiveRating(ratingMeasure) {
  if (!ratingMeasure) return null;
  
  if (ratingMeasure.manual_override && ratingMeasure.rating !== null) {
    return ratingMeasure.rating;
  }
  
  return ratingMeasure.computed_rating || ratingMeasure.rating || null;
}

/**
 * Convert rating level to numeric value
 * @param {string} rating - Rating level (dark_green, light_green, etc.)
 * @returns {number|null} Numeric value (0.0 - 1.0)
 */
export function ratingToValue(rating) {
  if (!rating || !(rating in RATING_VALUES)) return null;
  return RATING_VALUES[rating];
}

/**
 * Convert numeric value to closest rating level
 * @param {number} value - Numeric value (0.0 - 1.0)
 * @returns {string|null} Rating level
 */
export function valueToRating(value) {
  if (value === null || value === undefined) return null;
  
  // Find closest rating level
  const numValue = Number(value);
  if (numValue >= 0.875) return 'dark_green';
  if (numValue >= 0.625) return 'light_green';
  if (numValue >= 0.375) return 'yellow';
  if (numValue >= 0.125) return 'orange';
  return 'red';
}

/**
 * Extract the value from a criterion value record based on its type
 * @param {Object} criterionValue - The rating_criteria_values record
 * @param {Object} criterionDefinition - The rating_criteria_definitions record
 * @returns {any} The extracted value
 */
export function extractCriterionValue(criterionValue, criterionDefinition) {
  if (!criterionValue || !criterionDefinition) return null;
  
  switch (criterionDefinition.type) {
    case 'quantitative':
      return criterionValue.value_quantitative;
    case 'categorical':
      return criterionValue.value_categorical;
    case 'logical':
      return criterionValue.value_logical;
    default:
      // Try to get any available value
      return criterionValue.value_quantitative ?? 
             criterionValue.value_categorical ?? 
             criterionValue.value_logical ?? 
             null;
  }
}

/**
 * Build a criteria values map from an array of criterion values
 * @param {Array} criteriaValues - Array of rating_criteria_values records (with joined definitions)
 * @returns {Object} Map of criterion key -> value
 */
export function buildCriteriaMap(criteriaValues) {
  const map = {};
  
  if (!Array.isArray(criteriaValues)) return map;
  
  for (const cv of criteriaValues) {
    const definition = cv.criterion_definition_id;
    if (!definition?.key) continue;
    
    map[definition.key] = extractCriterionValue(cv, definition);
  }
  
  return map;
}

/**
 * Evaluate a condition against a value
 * @param {Object} condition - Condition object with type and parameters
 * @param {any} value - The value to test
 * @returns {boolean} Whether the condition is met
 */
export function evaluateCondition(condition, value) {
  if (!condition || !condition.type) return false;
  
  switch (condition.type) {
    case 'equals':
      return value === condition.value;
      
    case 'not_equals':
      return value !== condition.value;
      
    case 'greater_than':
      return Number(value) > Number(condition.value);
      
    case 'greater_than_or_equals':
      return Number(value) >= Number(condition.value);
      
    case 'less_than':
      return Number(value) < Number(condition.value);
      
    case 'less_than_or_equals':
      return Number(value) <= Number(condition.value);
      
    case 'between':
      const numValue = Number(value);
      return numValue >= Number(condition.min) && numValue <= Number(condition.max);
      
    case 'in':
      return Array.isArray(condition.values) && condition.values.includes(value);
      
    case 'not_in':
      return !Array.isArray(condition.values) || !condition.values.includes(value);
      
    case 'is_null':
      return value === null || value === undefined;
      
    case 'is_not_null':
      return value !== null && value !== undefined;
      
    case 'matches_regex':
      try {
        return new RegExp(condition.pattern).test(String(value));
      } catch {
        return false;
      }
      
    default:
      console.warn(`Unknown condition type: ${condition.type}`);
      return false;
  }
}

/**
 * Execute a rating function to compute a rating
 * @param {Object} ratingFunction - Rating function definition
 * @param {Object} criteriaMap - Map of criterion key -> value
 * @returns {string|null} Computed rating level
 */
export function executeRatingFunction(ratingFunction, criteriaMap) {
  if (!ratingFunction || !ratingFunction.type) return null;
  
  switch (ratingFunction.type) {
    case 'direct_mapping':
      // Simply return the specified rating
      return ratingFunction.rating || null;
      
    case 'quantity_map':
      return executeQuantityMap(ratingFunction, criteriaMap);
      
    case 'logical_combinations':
      return executeLogicalCombinations(ratingFunction, criteriaMap);
      
    case 'quality_fulfillment':
      return executeQualityFulfillment(ratingFunction, criteriaMap);
      
    default:
      console.warn(`Unknown rating function type: ${ratingFunction.type}`);
      return null;
  }
}

/**
 * Execute a quantity_map rating function
 * Maps numeric ranges to ratings
 * @param {Object} ratingFunction - { type: 'quantity_map', criterionKey, thresholds: [...] }
 * @param {Object} criteriaMap - Criteria values map
 * @returns {string|null} Computed rating
 */
function executeQuantityMap(ratingFunction, criteriaMap) {
  const { criterionKey, thresholds } = ratingFunction;
  
  if (!criterionKey || !Array.isArray(thresholds)) return null;
  
  const value = criteriaMap[criterionKey];
  if (value === null || value === undefined) return null;
  
  const numValue = Number(value);
  
  // Sort thresholds by min value (ascending)
  const sortedThresholds = [...thresholds].sort((a, b) => 
    (a.min ?? -Infinity) - (b.min ?? -Infinity)
  );
  
  // Find matching threshold
  for (const threshold of sortedThresholds) {
    const min = threshold.min ?? -Infinity;
    const max = threshold.max ?? Infinity;
    
    if (numValue >= min && numValue <= max) {
      return threshold.rating;
    }
  }
  
  return null;
}

/**
 * Execute a logical_combinations rating function
 * Combines multiple boolean criteria using AND/OR logic
 * @param {Object} ratingFunction - { type: 'logical_combinations', rules: [...] }
 * @param {Object} criteriaMap - Criteria values map
 * @returns {string|null} Computed rating
 */
function executeLogicalCombinations(ratingFunction, criteriaMap) {
  const { rules } = ratingFunction;
  
  if (!Array.isArray(rules)) return null;
  
  // Evaluate rules in order - first matching rule wins
  for (const rule of rules) {
    if (evaluateLogicalRule(rule.condition, criteriaMap)) {
      return rule.rating;
    }
  }
  
  // If no rule matches, return default if specified
  return ratingFunction.default || null;
}

/**
 * Evaluate a logical rule condition
 * @param {Object} condition - { type: 'and'|'or', conditions: [...] } or leaf condition
 * @param {Object} criteriaMap - Criteria values map
 * @returns {boolean}
 */
function evaluateLogicalRule(condition, criteriaMap) {
  if (!condition) return false;
  
  // Handle AND/OR combinators
  if (condition.type === 'and') {
    return condition.conditions.every(c => evaluateLogicalRule(c, criteriaMap));
  }
  
  if (condition.type === 'or') {
    return condition.conditions.some(c => evaluateLogicalRule(c, criteriaMap));
  }
  
  if (condition.type === 'not') {
    return !evaluateLogicalRule(condition.condition, criteriaMap);
  }
  
  // Leaf condition - evaluate against criterion value
  if (condition.criterionKey) {
    const value = criteriaMap[condition.criterionKey];
    return evaluateCondition(condition, value);
  }
  
  return false;
}

/**
 * Execute a quality_fulfillment rating function
 * Scores based on how many quality criteria are fulfilled
 * @param {Object} ratingFunction - { type: 'quality_fulfillment', criteria: [...], scoreMapping: {...} }
 * @param {Object} criteriaMap - Criteria values map
 * @returns {string|null} Computed rating
 */
function executeQualityFulfillment(ratingFunction, criteriaMap) {
  const { criteria, scoreMapping } = ratingFunction;
  
  if (!Array.isArray(criteria) || !scoreMapping) return null;
  
  // Count fulfilled criteria
  let fulfilledCount = 0;
  let totalWeight = 0;
  let weightedScore = 0;
  
  for (const criterion of criteria) {
    const weight = criterion.weight ?? 1;
    totalWeight += weight;
    
    const value = criteriaMap[criterion.key];
    const isFulfilled = evaluateCondition(criterion.condition, value);
    
    if (isFulfilled) {
      fulfilledCount++;
      weightedScore += weight;
    }
  }
  
  // Calculate percentage
  const percentage = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
  
  // Map to rating based on scoreMapping
  if (scoreMapping.type === 'thresholds') {
    for (const threshold of scoreMapping.thresholds) {
      if (percentage >= threshold.min && percentage <= (threshold.max ?? 100)) {
        return threshold.rating;
      }
    }
  } else if (scoreMapping.type === 'count') {
    for (const mapping of scoreMapping.mappings) {
      if (fulfilledCount >= mapping.min && fulfilledCount <= (mapping.max ?? Infinity)) {
        return mapping.rating;
      }
    }
  }
  
  return scoreMapping.default || null;
}

/**
 * Traverse a decision tree and compute a rating
 * @param {Object} tree - Decision tree structure { rootNodeId, nodes: {...} }
 * @param {Object} criteriaMap - Map of criterion key -> value
 * @returns {Object} { rating, path: [...] }
 */
export function traverseDecisionTree(tree, criteriaMap) {
  if (!tree || !tree.nodes || !tree.rootNodeId) {
    return { rating: null, path: [] };
  }
  
  const path = [];
  let currentNodeId = tree.rootNodeId;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops
  
  while (currentNodeId && iterations < maxIterations) {
    iterations++;
    
    const node = tree.nodes[currentNodeId];
    if (!node) {
      console.warn(`Decision tree node not found: ${currentNodeId}`);
      break;
    }
    
    if (node.type === 'leaf') {
      // Reached a leaf node - compute final rating
      const rating = executeRatingFunction(node.ratingFunction, criteriaMap);
      
      path.push({
        nodeId: node.id,
        type: 'leaf',
        rating
      });
      
      return { rating, path };
    }
    
    if (node.type === 'decision') {
      // Decision node - evaluate criterion and follow branch
      const criterionValue = criteriaMap[node.criterionKey];
      
      let matchedBranch = null;
      
      // Find matching branch
      for (const branch of node.branches || []) {
        if (evaluateCondition(branch.condition, criterionValue)) {
          matchedBranch = branch;
          break;
        }
      }
      
      // Add to path
      path.push({
        nodeId: node.id,
        type: 'decision',
        criterionKey: node.criterionKey,
        question: node.question,
        value: criterionValue,
        answer: matchedBranch?.label,
        nextNode: matchedBranch?.targetNodeId
      });
      
      if (!matchedBranch) {
        // No matching branch - try default or stop
        if (node.defaultBranch) {
          currentNodeId = node.defaultBranch;
        } else {
          console.warn(`No matching branch in decision node: ${currentNodeId}`);
          break;
        }
      } else {
        currentNodeId = matchedBranch.targetNodeId;
      }
    } else {
      console.warn(`Unknown node type: ${node.type}`);
      break;
    }
  }
  
  if (iterations >= maxIterations) {
    console.error('Decision tree traversal exceeded maximum iterations');
  }
  
  return { rating: null, path };
}

/**
 * Compute a rating for a measure using its decision tree
 * @param {Object} measure - The measure record with decision_trees relation
 * @param {Array} criteriaValues - Array of rating_criteria_values records
 * @returns {Object} { rating, path, criteriaSnapshot }
 */
export function computeRating(measure, criteriaValues) {
  // Build criteria map
  const criteriaMap = buildCriteriaMap(criteriaValues);
  
  // Find active decision tree
  const activeTree = measure.decision_trees?.find(t => t.status === 'active');
  
  if (!activeTree?.tree_structure) {
    // No decision tree - try to use legacy rating calculation
    return {
      rating: null,
      path: [],
      criteriaSnapshot: criteriaMap,
      error: 'No active decision tree found'
    };
  }
  
  // Traverse decision tree
  const { rating, path } = traverseDecisionTree(activeTree.tree_structure, criteriaMap);
  
  return {
    rating,
    path,
    criteriaSnapshot: criteriaMap,
    decisionTreeVersion: activeTree.version
  };
}

/**
 * Validate a decision tree structure
 * @param {Object} tree - Decision tree structure
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateDecisionTree(tree) {
  const errors = [];
  
  if (!tree) {
    errors.push('Tree is null or undefined');
    return { valid: false, errors };
  }
  
  if (!tree.rootNodeId) {
    errors.push('Missing rootNodeId');
  }
  
  if (!tree.nodes || typeof tree.nodes !== 'object') {
    errors.push('Missing or invalid nodes object');
    return { valid: false, errors };
  }
  
  if (tree.rootNodeId && !tree.nodes[tree.rootNodeId]) {
    errors.push(`Root node "${tree.rootNodeId}" not found in nodes`);
  }
  
  // Validate each node
  const visitedNodes = new Set();
  const referencedNodes = new Set([tree.rootNodeId]);
  
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    visitedNodes.add(nodeId);
    
    if (!node.id) {
      errors.push(`Node missing id property: ${nodeId}`);
    } else if (node.id !== nodeId) {
      errors.push(`Node id mismatch: ${nodeId} vs ${node.id}`);
    }
    
    if (!node.type) {
      errors.push(`Node "${nodeId}" missing type`);
    } else if (node.type === 'decision') {
      if (!node.criterionKey) {
        errors.push(`Decision node "${nodeId}" missing criterionKey`);
      }
      if (!Array.isArray(node.branches) || node.branches.length === 0) {
        errors.push(`Decision node "${nodeId}" missing branches`);
      } else {
        for (const branch of node.branches) {
          if (!branch.targetNodeId) {
            errors.push(`Branch in node "${nodeId}" missing targetNodeId`);
          } else {
            referencedNodes.add(branch.targetNodeId);
          }
        }
      }
    } else if (node.type === 'leaf') {
      if (!node.ratingFunction) {
        errors.push(`Leaf node "${nodeId}" missing ratingFunction`);
      }
    }
  }
  
  // Check for unreachable nodes
  for (const nodeId of visitedNodes) {
    if (!referencedNodes.has(nodeId) && nodeId !== tree.rootNodeId) {
      errors.push(`Unreachable node: ${nodeId}`);
    }
  }
  
  // Check for missing referenced nodes
  for (const nodeId of referencedNodes) {
    if (!visitedNodes.has(nodeId)) {
      errors.push(`Referenced node not found: ${nodeId}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if criteria values have changed since last computation
 * @param {Object} currentCriteria - Current criteria map
 * @param {Object} snapshot - Previous criteria snapshot
 * @returns {boolean} Whether criteria have changed
 */
export function haveCriteriaChanged(currentCriteria, snapshot) {
  if (!snapshot) return true;
  
  const currentKeys = Object.keys(currentCriteria);
  const snapshotKeys = Object.keys(snapshot);
  
  // Check for added/removed keys
  if (currentKeys.length !== snapshotKeys.length) return true;
  
  // Check for value changes
  for (const key of currentKeys) {
    if (!(key in snapshot)) return true;
    if (currentCriteria[key] !== snapshot[key]) return true;
  }
  
  return false;
}

export default {
  RATING_LEVELS,
  RATING_VALUES,
  VALUE_TO_RATING,
  RATING_DISPLAY,
  getEffectiveRating,
  ratingToValue,
  valueToRating,
  extractCriterionValue,
  buildCriteriaMap,
  evaluateCondition,
  executeRatingFunction,
  traverseDecisionTree,
  computeRating,
  validateDecisionTree,
  haveCriteriaChanged
};
