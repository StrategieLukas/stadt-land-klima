/**
 * Catalog Administration Composable
 * 
 * Provides CRUD operations and statistics for measure catalogs.
 * Admin-only functionality.
 */

import { ref, computed } from 'vue';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { createDirectus, rest, authentication, readItems } from '@directus/sdk';
import { useAuthStore } from '~/stores/auth';

export function useCatalogAdmin() {
  const { $readItems } = useNuxtApp();
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  
  const catalogs = ref([]);
  const catalogStats = ref({});
  const isLoading = ref(false);
  const error = ref(null);

  /**
   * Create authenticated Directus client
   */
  function createAuthenticatedClient() {
    const baseUrl = process.client 
      ? config.public.clientDirectusUrl 
      : config.public.serverDirectusUrl;
    
    const client = createDirectus(baseUrl || 'http://localhost:8055')
      .with(rest())
      .with(authentication('json'));
    
    // Add auth token for authenticated requests
    // Note: accessToken is a readonly ref, so we need to access .value
    const token = authStore.accessToken?.value;
    if (token) {
      client.setToken(token);
    }
    
    return client;
  }

  /**
   * Fetch all measure catalogs with related data
   */
  async function fetchCatalogs() {
    isLoading.value = true;
    error.value = null;
    
    try {
      const directus = createAuthenticatedClient();
      
      const result = await directus.request(
        readItems('measure_catalog', {
          fields: [
            'id',
            'name',
            'description',
            'catalog_type',
            'uses_structured_ratings',
            'version_number',
            'isCurrentFrontend',
            'isCurrentBackend',
            'hidden',
            'date_created'
          ],
          sort: ['-date_created'],
          limit: -1
        })
      );
      
      catalogs.value = result || [];
      
      // Fetch stats for each catalog
      await Promise.all(catalogs.value.map(c => fetchCatalogStats(c.id)));
      
      return catalogs.value;
    } catch (err) {
      error.value = err.message || 'Failed to fetch catalogs';
      console.error('Error fetching catalogs:', err);
      return [];
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch statistics for a specific catalog
   */
  async function fetchCatalogStats(catalogId) {
    try {
      const directus = createAuthenticatedClient();
      
      // Get measure count
      const measures = await directus.request(
        readItems('measures', {
          filter: { catalog_version: { _eq: catalogId } },
          fields: ['id'],
          limit: -1
        })
      );
      
      // Get ratings count
      const ratings = await directus.request(
        readItems('ratings_measures', {
          filter: { 
            measure_id: { catalog_version: { _eq: catalogId } }
          },
          fields: ['id', 'rating', 'applicable', 'localteam_id'],
          limit: -1
        })
      );
      
      // Get municipalities count
      const municipalities = await directus.request(
        readItems('municipalities', {
          fields: ['id', 'localteam_id'],
          limit: -1
        })
      );
      
      const measureCount = measures?.length || 0;
      const totalMunicipalities = municipalities?.length || 0;
      
      // Calculate completion
      const ratingsWithValue = ratings?.filter(r => r.rating !== null && r.applicable) || [];
      const uniqueLocalteams = new Set(ratings?.map(r => r.localteam_id).filter(Boolean));
      
      // For legacy: municipalities * measures that have ratings
      const legacyTotal = totalMunicipalities * measureCount;
      const legacyRated = ratingsWithValue.length;
      
      catalogStats.value[catalogId] = {
        measureCount,
        totalMunicipalities,
        uniqueLocalteamsRated: uniqueLocalteams.size,
        ratingsCount: ratings?.length || 0,
        ratingsWithValue: legacyRated,
        legacyCompletionPercent: legacyTotal > 0 
          ? Math.round((legacyRated / legacyTotal) * 100) 
          : 0,
        legacyTotal,
        // Structured stats would require criteria_values count
        structuredTotal: 0,
        structuredRated: 0,
        structuredCompletionPercent: 0
      };
      
      return catalogStats.value[catalogId];
    } catch (err) {
      console.error(`Error fetching stats for catalog ${catalogId}:`, err);
      return null;
    }
  }

  /**
   * Set a catalog as current frontend or backend
   */
  async function setCurrentCatalog(catalogId, field, catalogType) {
    if (!['isCurrentFrontend', 'isCurrentBackend'].includes(field)) {
      throw new Error('Invalid field');
    }
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const directus = createAuthenticatedClient();
      const { updateItem } = await import('@directus/sdk');
      
      // First, unset all catalogs of the same type for this field
      const catalogsToUnset = catalogs.value.filter(c => 
        c.catalog_type === catalogType && c[field] === true
      );
      
      for (const cat of catalogsToUnset) {
        await directus.request(
          updateItem('measure_catalog', cat.id, { [field]: false })
        );
      }
      
      // Then set the selected catalog
      await directus.request(
        updateItem('measure_catalog', catalogId, { [field]: true })
      );
      
      // Refresh catalogs
      await fetchCatalogs();
      
      return true;
    } catch (err) {
      error.value = err.message || 'Failed to update catalog';
      console.error('Error updating catalog:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Create a new measure catalog
   */
  async function createCatalog(data) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const directus = createAuthenticatedClient();
      const { createItem } = await import('@directus/sdk');
      
      const newCatalog = await directus.request(
        createItem('measure_catalog', {
          name: data.name,
          description: data.description || '',
          catalog_type: data.catalog_type || 'climate_mitigation',
          uses_structured_ratings: data.uses_structured_ratings || false,
          version_number: data.version_number || '1.0.0',
          isCurrentFrontend: false,
          isCurrentBackend: false,
          hidden: data.hidden || false
        })
      );
      
      // If importing from another catalog, copy measures
      if (data.importFromCatalogId) {
        await importMeasuresFromCatalog(newCatalog.id, data.importFromCatalogId);
      }
      
      await fetchCatalogs();
      return newCatalog;
    } catch (err) {
      error.value = err.message || 'Failed to create catalog';
      console.error('Error creating catalog:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Import measures from another catalog
   */
  async function importMeasuresFromCatalog(targetCatalogId, sourceCatalogId) {
    try {
      const directus = createAuthenticatedClient();
      const { createItem } = await import('@directus/sdk');
      
      // Fetch source measures
      const sourceMeasures = await directus.request(
        readItems('measures', {
          filter: { catalog_version: { _eq: sourceCatalogId } },
          fields: [
            'measure_id', 'name', 'description', 'sector', 'weight',
            'description_about', 'description_evaluation_criteria',
            'description_verification', 'description_benefit',
            'description_implementation', 'description_funding',
            'description_legal', 'description_tutorial',
            'impact', 'feasibility', 'feasibility_economical', 'feasibility_political',
            'choices_rating', 'must_be_rated_again'
          ],
          limit: -1
        })
      );
      
      // Create measures in target catalog
      for (const measure of sourceMeasures) {
        const { id, ...measureData } = measure;
        await directus.request(
          createItem('measures', {
            ...measureData,
            catalog_version: targetCatalogId,
            status: 'draft',
            slug: `${measureData.measure_id}-${Date.now()}`
          })
        );
      }
      
      return true;
    } catch (err) {
      console.error('Error importing measures:', err);
      throw err;
    }
  }

  /**
   * Update catalog metadata
   */
  async function updateCatalog(catalogId, data) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const directus = createAuthenticatedClient();
      const { updateItem } = await import('@directus/sdk');
      
      await directus.request(
        updateItem('measure_catalog', catalogId, data)
      );
      
      await fetchCatalogs();
      return true;
    } catch (err) {
      error.value = err.message || 'Failed to update catalog';
      console.error('Error updating catalog:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete a catalog (with safety checks)
   */
  async function deleteCatalog(catalogId) {
    const catalog = catalogs.value.find(c => c.id === catalogId);
    
    if (!catalog) {
      error.value = 'Catalog not found';
      return false;
    }
    
    if (catalog.isCurrentFrontend || catalog.isCurrentBackend) {
      error.value = 'Cannot delete a catalog that is currently active';
      return false;
    }
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const directus = createAuthenticatedClient();
      const { deleteItem } = await import('@directus/sdk');
      
      await directus.request(
        deleteItem('measure_catalog', catalogId)
      );
      
      await fetchCatalogs();
      return true;
    } catch (err) {
      error.value = err.message || 'Failed to delete catalog';
      console.error('Error deleting catalog:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Computed helpers
  const catalogsByType = computed(() => {
    const grouped = {
      climate_mitigation: [],
      climate_adaption: []
    };
    
    for (const catalog of catalogs.value) {
      const type = catalog.catalog_type || 'climate_mitigation';
      if (grouped[type]) {
        grouped[type].push(catalog);
      }
    }
    
    return grouped;
  });

  const currentFrontendCatalog = computed(() => {
    return (type) => catalogs.value.find(c => 
      c.catalog_type === type && c.isCurrentFrontend
    );
  });

  const currentBackendCatalog = computed(() => {
    return (type) => catalogs.value.find(c => 
      c.catalog_type === type && c.isCurrentBackend
    );
  });

  return {
    // State
    catalogs,
    catalogStats,
    isLoading,
    error,
    
    // Computed
    catalogsByType,
    currentFrontendCatalog,
    currentBackendCatalog,
    
    // Actions
    fetchCatalogs,
    fetchCatalogStats,
    setCurrentCatalog,
    createCatalog,
    updateCatalog,
    deleteCatalog,
    importMeasuresFromCatalog
  };
}

export default useCatalogAdmin;
