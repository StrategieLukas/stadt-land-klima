/**
 * Rating Engine - Computes ratings based on decision trees and criteria values
 * This is a server-side version of the rating engine for use in Directus hooks
 */

// Rating level constants
export const RATING_LEVELS = ['dark_green', 'light_green', 'yellow', 'orange', 'red'];

export const RATING_VALUES = {
  dark_green: 1.0,
  light_green: 0.75,
  yellow: 0.5,
  orange: 0.25,
  red: 0.0
};

/**
 * Convert rating level to numeric value
 */
export function ratingToValue(rating) {
  return RATING_VALUES[rating] ?? null;
}

/**
 * Convert numeric value to rating level
 */
export function valueToRating(value) {
  if (value === null || value === undefined) return null;
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return null;
  
  // Find closest rating level
  let closestRating = null;
  let closestDiff = Infinity;
  
  for (const [rating, ratingValue] of Object.entries(RATING_VALUES)) {
    const diff = Math.abs(numValue - ratingValue);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestRating = rating;
    }
  }
  
  return closestRating;
}

/**
 * Build a map of criteria definitions keyed by criterion_key
 */
export function buildCriteriaMap(criteriaDefinitions) {
  const map = new Map();
  for (const def of criteriaDefinitions) {
    map.set(def.criterion_key, def);
  }
  return map;
}

/**
 * Build a map of criteria values keyed by criterion_key
 */
export function buildValuesMap(criteriaValues) {
  const map = new Map();
  for (const val of criteriaValues) {
    const key = typeof val.criterion_definition === 'object' 
      ? val.criterion_definition.criterion_key 
      : val.criterion_key;
    if (key) {
      map.set(key, val);
    }
  }
  return map;
}

/**
 * Extract the actual value from a criterion value record
 */
export function extractCriterionValue(criterionValue, criteriaMap) {
  if (!criterionValue) return null;
  
  const defKey = typeof criterionValue.criterion_definition === 'object'
    ? criterionValue.criterion_definition.criterion_key
    : criterionValue.criterion_key;
  
  const definition = criteriaMap?.get(defKey);
  const dataType = definition?.data_type || 'string';
  
  switch (dataType) {
    case 'number':
      return criterionValue.value_number;
    case 'boolean':
      return criterionValue.value_boolean;
    case 'json':
      return criterionValue.value_json;
    case 'string':
    default:
      return criterionValue.value_text;
  }
}

/**
 * Evaluate a condition against criterion values
 */
export function evaluateCondition(condition, valuesMap, criteriaMap) {
  if (!condition) return true;
  
  const { criterion_key, operator, value } = condition;
  
  if (!criterion_key) return true;
  
  const criterionValue = valuesMap.get(criterion_key);
  const actualValue = extractCriterionValue(criterionValue, criteriaMap);
  
  // Handle null/undefined actual values
  if (actualValue === null || actualValue === undefined) {
    if (operator === 'is_null') return true;
    if (operator === 'is_not_null') return false;
    return false; // Most conditions fail with null values
  }
  
  switch (operator) {
    case 'equals':
    case 'eq':
      return actualValue == value; // Loose equality for type coercion
    case 'not_equals':
    case 'neq':
      return actualValue != value;
    case 'greater_than':
    case 'gt':
      return Number(actualValue) > Number(value);
    case 'greater_than_or_equals':
    case 'gte':
      return Number(actualValue) >= Number(value);
    case 'less_than':
    case 'lt':
      return Number(actualValue) < Number(value);
    case 'less_than_or_equals':
    case 'lte':
      return Number(actualValue) <= Number(value);
    case 'contains':
      return String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not_contains':
      return !String(actualValue).toLowerCase().includes(String(value).toLowerCase());
    case 'in':
      return Array.isArray(value) ? value.includes(actualValue) : false;
    case 'not_in':
      return Array.isArray(value) ? !value.includes(actualValue) : true;
    case 'is_null':
      return false; // Already handled above
    case 'is_not_null':
      return true; // Already handled above
    case 'is_true':
      return actualValue === true || actualValue === 'true' || actualValue === 1;
    case 'is_false':
      return actualValue === false || actualValue === 'false' || actualValue === 0;
    default:
      return false;
  }
}

/**
 * Execute a rating function to compute the rating
 */
export function executeRatingFunction(functionDef, valuesMap, criteriaMap) {
  if (!functionDef) return null;
  
  const { function_type, function_config } = functionDef;
  
  switch (function_type) {
    case 'direct_mapping':
      return executeDirectMapping(function_config, valuesMap, criteriaMap);
    case 'quantity_map':
      return executeQuantityMap(function_config, valuesMap, criteriaMap);
    case 'logical_combinations':
      return executeLogicalCombinations(function_config, valuesMap, criteriaMap);
    case 'quality_fulfillment':
      return executeQualityFulfillment(function_config, valuesMap, criteriaMap);
    default:
      return null;
  }
}

/**
 * Direct mapping: map criterion value directly to rating level
 */
function executeDirectMapping(config, valuesMap, criteriaMap) {
  if (!config?.criterion_key || !config?.mapping) return null;
  
  const criterionValue = valuesMap.get(config.criterion_key);
  const actualValue = extractCriterionValue(criterionValue, criteriaMap);
  
  if (actualValue === null || actualValue === undefined) return null;
  
  // Look up in mapping
  const normalizedValue = String(actualValue).toLowerCase();
  for (const [mappedValue, rating] of Object.entries(config.mapping)) {
    if (String(mappedValue).toLowerCase() === normalizedValue) {
      return rating;
    }
  }
  
  return config.default_rating || null;
}

/**
 * Quantity map: map numeric value to rating based on ranges
 */
function executeQuantityMap(config, valuesMap, criteriaMap) {
  if (!config?.criterion_key || !config?.ranges) return null;
  
  const criterionValue = valuesMap.get(config.criterion_key);
  const actualValue = extractCriterionValue(criterionValue, criteriaMap);
  
  if (actualValue === null || actualValue === undefined) return null;
  
  const numValue = Number(actualValue);
  if (isNaN(numValue)) return null;
  
  // Find matching range
  for (const range of config.ranges) {
    const { min, max, rating } = range;
    const minVal = min !== undefined && min !== null ? Number(min) : -Infinity;
    const maxVal = max !== undefined && max !== null ? Number(max) : Infinity;
    
    if (numValue >= minVal && numValue <= maxVal) {
      return rating;
    }
  }
  
  return config.default_rating || null;
}

/**
 * Logical combinations: evaluate multiple conditions with AND/OR logic
 */
function executeLogicalCombinations(config, valuesMap, criteriaMap) {
  if (!config?.rules) return null;
  
  const logicType = config.logic || 'and';
  
  for (const rule of config.rules) {
    const { conditions, rating } = rule;
    if (!conditions || !rating) continue;
    
    let ruleMatches;
    if (logicType === 'and') {
      ruleMatches = conditions.every(cond => evaluateCondition(cond, valuesMap, criteriaMap));
    } else {
      ruleMatches = conditions.some(cond => evaluateCondition(cond, valuesMap, criteriaMap));
    }
    
    if (ruleMatches) {
      return rating;
    }
  }
  
  return config.default_rating || null;
}

/**
 * Quality fulfillment: count how many quality criteria are fulfilled
 */
function executeQualityFulfillment(config, valuesMap, criteriaMap) {
  if (!config?.criteria_keys || !config?.thresholds) return null;
  
  let fulfilledCount = 0;
  
  for (const key of config.criteria_keys) {
    const criterionValue = valuesMap.get(key);
    const actualValue = extractCriterionValue(criterionValue, criteriaMap);
    
    // Check if fulfilled (truthy for boolean, non-empty for strings, > 0 for numbers)
    const isFulfilled = actualValue === true || 
                        actualValue === 'true' || 
                        actualValue === 'yes' ||
                        (typeof actualValue === 'number' && actualValue > 0) ||
                        (typeof actualValue === 'string' && actualValue.trim().length > 0);
    
    if (isFulfilled) {
      fulfilledCount++;
    }
  }
  
  // Find matching threshold
  const sortedThresholds = [...config.thresholds].sort((a, b) => (b.min_count || 0) - (a.min_count || 0));
  
  for (const threshold of sortedThresholds) {
    if (fulfilledCount >= (threshold.min_count || 0)) {
      return threshold.rating;
    }
  }
  
  return config.default_rating || null;
}

/**
 * Traverse a decision tree to compute rating
 */
export function traverseDecisionTree(tree, valuesMap, criteriaMap) {
  if (!tree?.root) {
    return { rating: null, path: [], error: 'No decision tree root' };
  }
  
  const path = [];
  let currentNode = tree.root;
  let iteration = 0;
  const maxIterations = 100; // Prevent infinite loops
  
  while (currentNode && iteration < maxIterations) {
    iteration++;
    
    // Add to path
    path.push({
      nodeId: currentNode.id,
      nodeLabel: currentNode.label,
      nodeType: currentNode.type
    });
    
    // Handle leaf nodes
    if (currentNode.type === 'result') {
      // Execute rating function if present
      if (currentNode.rating_function) {
        const rating = executeRatingFunction(currentNode.rating_function, valuesMap, criteriaMap);
        path[path.length - 1].computedRating = rating;
        return { rating, path, functionUsed: currentNode.rating_function.function_type };
      }
      
      // Direct rating result
      if (currentNode.rating) {
        path[path.length - 1].computedRating = currentNode.rating;
        return { rating: currentNode.rating, path };
      }
      
      return { rating: null, path, error: 'Result node has no rating or function' };
    }
    
    // Handle decision nodes
    if (currentNode.type === 'decision' || currentNode.type === 'condition') {
      if (!currentNode.branches || currentNode.branches.length === 0) {
        return { rating: null, path, error: `Decision node ${currentNode.id} has no branches` };
      }
      
      // Find matching branch
      let matchedBranch = null;
      
      for (const branch of currentNode.branches) {
        if (branch.condition) {
          const matches = evaluateCondition(branch.condition, valuesMap, criteriaMap);
          if (matches) {
            matchedBranch = branch;
            path[path.length - 1].matchedCondition = branch.condition;
            path[path.length - 1].answer = branch.label || 'Condition matched';
            break;
          }
        } else if (branch.is_default) {
          // Store as fallback
          matchedBranch = matchedBranch || branch;
        }
      }
      
      if (!matchedBranch) {
        return { rating: null, path, error: `No matching branch for decision node ${currentNode.id}` };
      }
      
      currentNode = matchedBranch.next_node;
    } else {
      return { rating: null, path, error: `Unknown node type: ${currentNode.type}` };
    }
  }
  
  if (iteration >= maxIterations) {
    return { rating: null, path, error: 'Maximum iterations reached - possible cycle' };
  }
  
  return { rating: null, path, error: 'Unexpected end of tree traversal' };
}

/**
 * Main function to compute rating for a measure
 */
export function computeRating(decisionTree, criteriaValues, criteriaDefinitions) {
  if (!decisionTree?.tree_structure) {
    return {
      rating: null,
      path: [],
      error: 'No decision tree structure'
    };
  }
  
  const criteriaMap = buildCriteriaMap(criteriaDefinitions || []);
  const valuesMap = buildValuesMap(criteriaValues || []);
  
  return traverseDecisionTree(decisionTree.tree_structure, valuesMap, criteriaMap);
}

/**
 * Get effective rating considering manual override
 */
export function getEffectiveRating(computedRating, manualOverride) {
  if (manualOverride && RATING_LEVELS.includes(manualOverride)) {
    return manualOverride;
  }
  return computedRating;
}
