/**
 * Criteria Values Composable
 * 
 * Provides functionality for managing criterion values and their sources
 * for a specific rating measure.
 */

import { ref, computed } from 'vue';
import { createDirectus, rest, readItems, updateItem, createItem, deleteItem } from '@directus/sdk';
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
 * Composable for managing criteria values
 * @param {string} ratingMeasureId - The rating measure ID
 */
export function useCriteriaValues(ratingMeasureId = null) {
  const client = useDirectusClient();
  
  // State
  const criteriaValues = ref([]);
  const sources = ref([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref(null);
  
  // Computed
  const criteriaMap = computed(() => {
    return ratingEngine.buildCriteriaMap(criteriaValues.value);
  });
  
  const completedCount = computed(() => {
    return criteriaValues.value.filter(cv => {
      const value = ratingEngine.extractCriterionValue(cv, cv.criterion_definition_id);
      return value !== null && value !== undefined;
    }).length;
  });
  
  const totalCount = computed(() => {
    return criteriaValues.value.length;
  });
  
  const completionPercentage = computed(() => {
    if (totalCount.value === 0) return 0;
    return Math.round((completedCount.value / totalCount.value) * 100);
  });
  
  // Methods
  async function loadCriteriaValues() {
    if (!ratingMeasureId) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const data = await client.request(
        readItems('rating_criteria_values', {
          filter: { rating_measure_id: { _eq: ratingMeasureId } },
          fields: [
            '*',
            { criterion_definition_id: ['*'] },
            { 
              sources: [
                '*',
                { source_id: ['*'] }
              ]
            },
            { verified_by: ['id', 'first_name', 'last_name'] }
          ]
        })
      );
      
      criteriaValues.value = data;
      
    } catch (err) {
      error.value = err.message || 'Failed to load criteria values';
      console.error('Failed to load criteria values:', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Get a criterion value by its definition key
   * @param {string} key - Criterion definition key
   */
  function getCriterionValue(key) {
    return criteriaValues.value.find(
      cv => cv.criterion_definition_id?.key === key
    );
  }
  
  /**
   * Get the extracted value for a criterion key
   * @param {string} key - Criterion definition key
   */
  function getValue(key) {
    const cv = getCriterionValue(key);
    if (!cv) return null;
    return ratingEngine.extractCriterionValue(cv, cv.criterion_definition_id);
  }
  
  /**
   * Set a criterion value
   * @param {Object} definition - Criterion definition
   * @param {any} value - The value to set
   */
  async function setValue(definition, value) {
    if (!ratingMeasureId || !definition) return;
    
    saving.value = true;
    error.value = null;
    
    try {
      // Find existing criterion value
      let cv = criteriaValues.value.find(
        v => v.criterion_definition_id?.id === definition.id
      );
      
      // Prepare value data
      const valueData = {
        rating_measure_id: ratingMeasureId,
        criterion_definition_id: definition.id,
        value_quantitative: definition.type === 'quantitative' ? value : null,
        value_categorical: definition.type === 'categorical' ? value : null,
        value_logical: definition.type === 'logical' ? value : null
      };
      
      if (cv?.id) {
        // Update existing
        const updated = await client.request(
          updateItem('rating_criteria_values', cv.id, valueData)
        );
        
        // Update in local array
        const index = criteriaValues.value.findIndex(v => v.id === cv.id);
        if (index !== -1) {
          criteriaValues.value[index] = { ...cv, ...updated };
        }
      } else {
        // Create new
        const created = await client.request(
          createItem('rating_criteria_values', valueData)
        );
        
        criteriaValues.value.push({
          ...created,
          criterion_definition_id: definition,
          sources: []
        });
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to save criterion value';
      console.error('Failed to save criterion value:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Update notes for a criterion value
   * @param {string} criterionValueId - The criterion value ID
   * @param {string} notes - Notes text
   */
  async function updateNotes(criterionValueId, notes) {
    saving.value = true;
    error.value = null;
    
    try {
      await client.request(
        updateItem('rating_criteria_values', criterionValueId, { notes })
      );
      
      // Update local state
      const cv = criteriaValues.value.find(v => v.id === criterionValueId);
      if (cv) {
        cv.notes = notes;
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to update notes';
      console.error('Failed to update notes:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Update confidence for a criterion value
   * @param {string} criterionValueId - The criterion value ID
   * @param {string} confidence - Confidence level (high, medium, low)
   */
  async function updateConfidence(criterionValueId, confidence) {
    saving.value = true;
    error.value = null;
    
    try {
      await client.request(
        updateItem('rating_criteria_values', criterionValueId, { confidence })
      );
      
      // Update local state
      const cv = criteriaValues.value.find(v => v.id === criterionValueId);
      if (cv) {
        cv.confidence = confidence;
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to update confidence';
      console.error('Failed to update confidence:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Mark a criterion value as verified
   * @param {string} criterionValueId - The criterion value ID
   */
  async function markVerified(criterionValueId) {
    const authStore = useAuthStore();
    
    saving.value = true;
    error.value = null;
    
    try {
      await client.request(
        updateItem('rating_criteria_values', criterionValueId, {
          last_verified_at: new Date().toISOString(),
          verified_by: authStore.user?.id
        })
      );
      
      // Update local state
      const cv = criteriaValues.value.find(v => v.id === criterionValueId);
      if (cv) {
        cv.last_verified_at = new Date().toISOString();
        cv.verified_by = authStore.user;
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to mark as verified';
      console.error('Failed to mark as verified:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Add a source to a criterion value
   * @param {string} criterionValueId - The criterion value ID
   * @param {Object} sourceData - Source data or existing source ID
   */
  async function addSource(criterionValueId, sourceData) {
    saving.value = true;
    error.value = null;
    
    try {
      let sourceId;
      
      // If sourceData has an id, use existing source, otherwise create new
      if (sourceData.id) {
        sourceId = sourceData.id;
      } else {
        const newSource = await client.request(
          createItem('rating_sources', {
            title: sourceData.title,
            source_type: sourceData.source_type,
            url: sourceData.url,
            file: sourceData.file,
            author: sourceData.author,
            publication_date: sourceData.publication_date,
            notes: sourceData.notes,
            is_reusable: sourceData.is_reusable ?? false
          })
        );
        sourceId = newSource.id;
      }
      
      // Create junction record
      const junction = await client.request(
        createItem('rating_criteria_sources', {
          criteria_value_id: criterionValueId,
          source_id: sourceId,
          relevance_note: sourceData.relevance_note,
          page_reference: sourceData.page_reference
        })
      );
      
      // Update local state
      const cv = criteriaValues.value.find(v => v.id === criterionValueId);
      if (cv) {
        if (!cv.sources) cv.sources = [];
        cv.sources.push({
          id: junction.id,
          source_id: sourceData.id ? sourceData : { id: sourceId, ...sourceData },
          relevance_note: sourceData.relevance_note,
          page_reference: sourceData.page_reference
        });
      }
      
      return junction;
      
    } catch (err) {
      error.value = err.message || 'Failed to add source';
      console.error('Failed to add source:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Remove a source from a criterion value
   * @param {string} criterionValueId - The criterion value ID
   * @param {string} junctionId - The junction table record ID
   */
  async function removeSource(criterionValueId, junctionId) {
    saving.value = true;
    error.value = null;
    
    try {
      await client.request(
        deleteItem('rating_criteria_sources', junctionId)
      );
      
      // Update local state
      const cv = criteriaValues.value.find(v => v.id === criterionValueId);
      if (cv?.sources) {
        cv.sources = cv.sources.filter(s => s.id !== junctionId);
      }
      
    } catch (err) {
      error.value = err.message || 'Failed to remove source';
      console.error('Failed to remove source:', err);
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Load reusable sources for selection
   */
  async function loadReusableSources() {
    loading.value = true;
    error.value = null;
    
    try {
      const data = await client.request(
        readItems('rating_sources', {
          filter: { is_reusable: { _eq: true } },
          fields: ['*'],
          sort: ['title']
        })
      );
      
      sources.value = data;
      return data;
      
    } catch (err) {
      error.value = err.message || 'Failed to load sources';
      console.error('Failed to load sources:', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Search sources by title
   * @param {string} query - Search query
   */
  async function searchSources(query) {
    if (!query || query.length < 2) return [];
    
    try {
      const data = await client.request(
        readItems('rating_sources', {
          filter: {
            _or: [
              { title: { _icontains: query } },
              { author: { _icontains: query } },
              { url: { _icontains: query } }
            ]
          },
          fields: ['*'],
          limit: 20
        })
      );
      
      return data;
      
    } catch (err) {
      console.error('Failed to search sources:', err);
      return [];
    }
  }
  
  return {
    // State
    criteriaValues,
    sources,
    loading,
    saving,
    error,
    
    // Computed
    criteriaMap,
    completedCount,
    totalCount,
    completionPercentage,
    
    // Methods
    loadCriteriaValues,
    getCriterionValue,
    getValue,
    setValue,
    updateNotes,
    updateConfidence,
    markVerified,
    addSource,
    removeSource,
    loadReusableSources,
    searchSources
  };
}

export default useCriteriaValues;
