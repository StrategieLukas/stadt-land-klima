/**
 * Composable for managing catalog version migrations
 * Provides functionality to create, execute, and monitor catalog migrations
 */

import { ref, computed } from 'vue';
import { useNuxtApp } from '#app';
import { 
  createMigration, 
  findRatingsToMigrate, 
  executeMigration, 
  rollbackMigration 
} from '~/shared/catalogMigration';

export function useCatalogMigration() {
  const { $directus } = useNuxtApp();
  
  const migrations = ref([]);
  const currentMigration = ref(null);
  const isLoading = ref(false);
  const isExecuting = ref(false);
  const error = ref(null);
  const progress = ref({ current: 0, total: 0, percentage: 0 });
  
  /**
   * Load all migrations
   */
  async function loadMigrations() {
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await $directus.items('catalog_migrations').readByQuery({
        sort: ['-date_created'],
        fields: ['*', 'source_version.*', 'target_version.*', 'executed_by.*'],
        limit: -1
      });
      
      migrations.value = response || [];
    } catch (err) {
      error.value = err.message;
      console.error('Failed to load migrations:', err);
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Load a specific migration
   */
  async function loadMigration(migrationId) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const response = await $directus.items('catalog_migrations').readOne(migrationId, {
        fields: ['*', 'source_version.*', 'target_version.*', 'executed_by.*']
      });
      
      currentMigration.value = response;
      return response;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to load migration:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Create a new migration
   */
  async function createNewMigration(options) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const migration = await createMigration($directus, options);
      migrations.value.unshift(migration);
      return migration;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to create migration:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Preview what ratings will be affected by a migration
   */
  async function previewMigration(sourceVersionId, targetVersionId) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const ratingsToMigrate = await findRatingsToMigrate(
        $directus, 
        sourceVersionId, 
        targetVersionId
      );
      
      return {
        count: ratingsToMigrate.length,
        ratings: ratingsToMigrate.slice(0, 50), // Return first 50 for preview
        hasMore: ratingsToMigrate.length > 50
      };
    } catch (err) {
      error.value = err.message;
      console.error('Failed to preview migration:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Execute a migration
   */
  async function runMigration(migrationId) {
    isExecuting.value = true;
    error.value = null;
    progress.value = { current: 0, total: 0, percentage: 0 };
    
    try {
      const result = await executeMigration($directus, migrationId);
      
      // Reload migration to get updated status
      await loadMigration(migrationId);
      
      return result;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to execute migration:', err);
      return null;
    } finally {
      isExecuting.value = false;
    }
  }
  
  /**
   * Rollback a migration
   */
  async function cancelMigration(migrationId) {
    isLoading.value = true;
    error.value = null;
    
    try {
      const result = await rollbackMigration($directus, migrationId);
      
      // Reload migration to get updated status
      await loadMigration(migrationId);
      
      return result;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to rollback migration:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Update a migration's transformation rules
   */
  async function updateTransformationRules(migrationId, rules) {
    isLoading.value = true;
    error.value = null;
    
    try {
      await $directus.items('catalog_migrations').updateOne(migrationId, {
        transformation_rules: rules
      });
      
      // Reload migration
      await loadMigration(migrationId);
      
      return true;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to update transformation rules:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }
  
  /**
   * Get catalog versions for migration selection
   */
  async function getCatalogVersions() {
    try {
      const response = await $directus.items('measure_catalog').readByQuery({
        sort: ['-version'],
        fields: ['id', 'name', 'version', 'status', 'isCurrentBackend'],
        limit: -1
      });
      
      return response || [];
    } catch (err) {
      console.error('Failed to load catalog versions:', err);
      return [];
    }
  }
  
  // Computed properties
  const pendingMigrations = computed(() => 
    migrations.value.filter(m => m.status === 'pending')
  );
  
  const inProgressMigrations = computed(() => 
    migrations.value.filter(m => m.status === 'in_progress')
  );
  
  const completedMigrations = computed(() => 
    migrations.value.filter(m => 
      m.status === 'completed' || m.status === 'completed_with_errors'
    )
  );
  
  const failedMigrations = computed(() => 
    migrations.value.filter(m => m.status === 'failed')
  );
  
  return {
    // State
    migrations,
    currentMigration,
    isLoading,
    isExecuting,
    error,
    progress,
    
    // Computed
    pendingMigrations,
    inProgressMigrations,
    completedMigrations,
    failedMigrations,
    
    // Methods
    loadMigrations,
    loadMigration,
    createNewMigration,
    previewMigration,
    runMigration,
    cancelMigration,
    updateTransformationRules,
    getCatalogVersions
  };
}
