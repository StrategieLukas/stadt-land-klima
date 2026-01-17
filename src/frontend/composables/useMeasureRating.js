/**
 * Measure Rating Composable
 * 
 * Provides functionality for loading, computing, and saving measure ratings
 * with support for the new structured criteria system.
 */

import { ref, computed, watch } from 'vue';
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
  
  // Add auth token if available
  // Note: accessToken is a readonly ref, so we need to access .value
  const token = authStore.accessToken?.value;
  if (token) {
    client.setToken(token);
  }
  
  return client;
}

/**
 * Composable for managing measure ratings
 * @param {string} measureId - The measure ID
 * @param {string} localteamId - The localteam ID (optional, for specific rating)
 */
export function useMeasureRating(measureId, localteamId = null) {
  const client = useDirectusClient();
  
  // State
  const measure = ref(null);
  const ratingMeasure = ref(null);
  const criteriaDefinitions = ref([]);
  const criteriaValues = ref([]);
  const decisionTree = ref(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref(null);
  
  // Computed
  const criteriaMap = computed(() => {
    return ratingEngine.buildCriteriaMap(criteriaValues.value);
  });
  
  const computedRating = computed(() => {
    if (!decisionTree.value?.tree_structure) return null;
    
    const result = ratingEngine.traverseDecisionTree(
      decisionTree.value.tree_structure,
      criteriaMap.value
    );
    
    return result.rating;
  });
  
  const decisionPath = computed(() => {
    if (!decisionTree.value?.tree_structure) return [];
    
    const result = ratingEngine.traverseDecisionTree(
      decisionTree.value.tree_structure,
      criteriaMap.value
    );
    
    return result.path;
  });
  
  const effectiveRating = computed(() => {
    return ratingEngine.getEffectiveRating(ratingMeasure.value);
  });
  
  const hasChanges = computed(() => {
    if (!ratingMeasure.value?.criteria_snapshot) return true;
    return ratingEngine.haveCriteriaChanged(criteriaMap.value, ratingMeasure.value.criteria_snapshot);
  });
  
  const isComplete = computed(() => {
    // Check if all required criteria have values
    return criteriaDefinitions.value.every(def => {
      if (def.status !== 'published') return true;
      const value = criteriaMap.value[def.key];
      return value !== null && value !== undefined;
    });
  });
  
  // Methods
  async function loadMeasure() {
    loading.value = true;
    error.value = null;
    
    try {
      // Load measure with criteria definitions and decision trees
      const measureData = await client.request(
        readItem('measures', measureId, {
          fields: [
            '*',
            { criteria_definitions: ['*'] },
            { decision_trees: ['*'] }
          ]
        })
      );
      
      measure.value = measureData;
      criteriaDefinitions.value = measureData.criteria_definitions || [];
      
      // Find active decision tree
      decisionTree.value = measureData.decision_trees?.find(t => t.status === 'active') || null;
      
    } catch (err) {
      error.value = err.message || 'Failed to load measure';
      console.error('Failed to load measure:', err);
    } finally {
      loading.value = false;
    }
  }
  
  async function loadRating() {
    if (!localteamId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      // Find existing rating for this measure and localteam
      const ratings = await client.request(
        readItems('ratings_measures', {
          filter: {
            measure_id: { _eq: measureId },
            localteam_id: { _eq: localteamId }
          },
          fields: [
            '*',
            { 
              criteria_values: [
                '*',
                { criterion_definition_id: ['*'] },
                { sources: ['*', { source_id: ['*'] }] }
              ]
            }
          ],
          limit: 1
        })
      );
      
      if (ratings.length > 0) {
        ratingMeasure.value = ratings[0];
        criteriaValues.value = ratings[0].criteria_values || [];
      } else {
        // Initialize empty rating
        ratingMeasure.value = {
          measure_id: measureId,
          localteam_id: localteamId,
          rating: null,
          computed_rating: null,
          manual_override: false,
          criteria_values: []
        };
        criteriaValues.value = [];
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to load rating';
      console.error('Failed to load rating:', err);
    } finally {
      loading.value = false;
    }
  }
  
  async function load() {
    await loadMeasure();
    if (localteamId) {
      await loadRating();
    }
  }
  
  /**
   * Update a criterion value
   * @param {string} criterionKey - The criterion definition key
   * @param {any} value - The new value
   */
  function updateCriterionValue(criterionKey, value) {
    const definition = criteriaDefinitions.value.find(d => d.key === criterionKey);
    if (!definition) return;
    
    // Find or create criterion value entry
    let cv = criteriaValues.value.find(
      v => v.criterion_definition_id?.id === definition.id || 
           v.criterion_definition_id === definition.id
    );
    
    if (!cv) {
      cv = {
        criterion_definition_id: definition,
        rating_measure_id: ratingMeasure.value?.id,
        value_quantitative: null,
        value_categorical: null,
        value_logical: null,
        sources: []
      };
      criteriaValues.value.push(cv);
    }
    
    // Set the appropriate value field based on type
    switch (definition.type) {
      case 'quantitative':
        cv.value_quantitative = value;
        break;
      case 'categorical':
        cv.value_categorical = value;
        break;
      case 'logical':
        cv.value_logical = value;
        break;
    }
  }
  
  /**
   * Save the rating and all criterion values
   */
  async function save() {
    saving.value = true;
    error.value = null;
    
    try {
      // Compute current rating
      const result = ratingEngine.computeRating(measure.value, criteriaValues.value);
      
      // Prepare rating data
      const ratingData = {
        measure_id: measureId,
        localteam_id: localteamId,
        computed_rating: result.rating,
        criteria_snapshot: result.criteriaSnapshot,
        decision_path: result.path,
        decision_tree_version: result.decisionTreeVersion,
        last_computed_at: new Date().toISOString(),
        needs_review: false
      };
      
      // If manual override is not set, update the visible rating too
      if (!ratingMeasure.value?.manual_override) {
        ratingData.rating = result.rating;
      }
      
      let savedRating;
      
      if (ratingMeasure.value?.id) {
        // Update existing rating
        savedRating = await client.request(
          updateItem('ratings_measures', ratingMeasure.value.id, ratingData)
        );
      } else {
        // Create new rating
        savedRating = await client.request(
          createItem('ratings_measures', ratingData)
        );
      }
      
      // Save criterion values
      for (const cv of criteriaValues.value) {
        const cvData = {
          rating_measure_id: savedRating.id,
          criterion_definition_id: cv.criterion_definition_id?.id || cv.criterion_definition_id,
          value_quantitative: cv.value_quantitative,
          value_categorical: cv.value_categorical,
          value_logical: cv.value_logical,
          confidence: cv.confidence,
          notes: cv.notes
        };
        
        if (cv.id) {
          await client.request(updateItem('rating_criteria_values', cv.id, cvData));
        } else {
          const newCv = await client.request(createItem('rating_criteria_values', cvData));
          cv.id = newCv.id;
        }
      }
      
      // Update local state
      ratingMeasure.value = savedRating;
      
      return savedRating;
      
    } catch (err) {
      error.value = err.message || 'Failed to save rating';
      console.error('Failed to save rating:', err);
      throw err;
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Set manual override for the rating
   * @param {string} manualRating - The manually set rating
   * @param {string} reason - Reason for override
   */
  async function setManualOverride(manualRating, reason = '') {
    if (!ratingMeasure.value?.id) {
      error.value = 'Must save rating before setting manual override';
      return;
    }
    
    saving.value = true;
    error.value = null;
    
    try {
      const updated = await client.request(
        updateItem('ratings_measures', ratingMeasure.value.id, {
          rating: manualRating,
          manual_override: true,
          override_reason: reason
        })
      );
      
      ratingMeasure.value = updated;
      
    } catch (err) {
      error.value = err.message || 'Failed to set manual override';
      console.error('Failed to set manual override:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Clear manual override and use computed rating
   */
  async function clearManualOverride() {
    if (!ratingMeasure.value?.id) return;
    
    saving.value = true;
    error.value = null;
    
    try {
      const updated = await client.request(
        updateItem('ratings_measures', ratingMeasure.value.id, {
          rating: ratingMeasure.value.computed_rating,
          manual_override: false,
          override_reason: null
        })
      );
      
      ratingMeasure.value = updated;
      
    } catch (err) {
      error.value = err.message || 'Failed to clear manual override';
      console.error('Failed to clear manual override:', err);
    } finally {
      saving.value = false;
    }
  }
  
  return {
    // State
    measure,
    ratingMeasure,
    criteriaDefinitions,
    criteriaValues,
    decisionTree,
    loading,
    saving,
    error,
    
    // Computed
    criteriaMap,
    computedRating,
    decisionPath,
    effectiveRating,
    hasChanges,
    isComplete,
    
    // Methods
    load,
    loadMeasure,
    loadRating,
    updateCriterionValue,
    save,
    setManualOverride,
    clearManualOverride
  };
}

export default useMeasureRating;
