/**
 * Catalog Version Migration Utility
 * 
 * This utility helps migrate ratings and criteria values between catalog versions.
 * It can be used to:
 * 1. Create migration records
 * 2. Clone ratings from one version to another
 * 3. Apply transformations to criteria values
 * 4. Track migration status
 */

/**
 * Create a new catalog migration record
 * @param {Object} directus - Directus SDK instance
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} - Created migration record
 */
export async function createMigration(directus, { 
  sourceVersion, 
  targetVersion, 
  migrationType = 'upgrade',
  transformationRules = null,
  notes = ''
}) {
  const migrationsCollection = directus.items('catalog_migrations');
  
  const migration = await migrationsCollection.createOne({
    source_version: sourceVersion,
    target_version: targetVersion,
    migration_type: migrationType,
    status: 'pending',
    transformation_rules: transformationRules,
    notes,
    started_at: null,
    completed_at: null,
    error_log: null,
    affected_ratings_count: 0,
    successful_migrations: 0,
    failed_migrations: 0
  });
  
  return migration;
}

/**
 * Find ratings that need migration
 * @param {Object} directus - Directus SDK instance
 * @param {string} sourceVersionId - Source catalog version ID
 * @param {string} targetVersionId - Target catalog version ID
 * @returns {Promise<Array>} - Array of ratings to migrate
 */
export async function findRatingsToMigrate(directus, sourceVersionId, targetVersionId) {
  const ratingsCollection = directus.items('ratings_measures');
  
  // Find all ratings from source version that don't have corresponding ratings in target
  const sourceRatings = await ratingsCollection.readByQuery({
    filter: {
      catalog_version: { _eq: sourceVersionId }
    },
    fields: ['*', 'criteria_values.*', 'measure_id.*'],
    limit: -1
  });
  
  // Check which ones already exist in target
  const existingTargetRatings = await ratingsCollection.readByQuery({
    filter: {
      catalog_version: { _eq: targetVersionId }
    },
    fields: ['localteam_id', 'measure_id'],
    limit: -1
  });
  
  const existingKeys = new Set(
    existingTargetRatings.map(r => `${r.localteam_id}-${r.measure_id}`)
  );
  
  return sourceRatings.filter(r => 
    !existingKeys.has(`${r.localteam_id}-${r.measure_id}`)
  );
}

/**
 * Clone a rating to a new catalog version
 * @param {Object} directus - Directus SDK instance
 * @param {Object} sourceRating - Source rating to clone
 * @param {string} targetVersionId - Target catalog version ID
 * @param {Object} transformRules - Optional transformation rules
 * @returns {Promise<Object>} - Created rating
 */
export async function cloneRating(directus, sourceRating, targetVersionId, transformRules = null) {
  const ratingsCollection = directus.items('ratings_measures');
  const criteriaValuesCollection = directus.items('rating_criteria_values');
  
  // Create new rating record (without computed fields)
  const newRating = await ratingsCollection.createOne({
    measure_id: sourceRating.measure_id,
    catalog_version: targetVersionId,
    localteam_id: sourceRating.localteam_id,
    status: 'draft',
    approved: false,
    applicable: sourceRating.applicable,
    why_not_applicable: sourceRating.why_not_applicable,
    source: sourceRating.source,
    internal_note: sourceRating.internal_note,
    current_progress: sourceRating.current_progress,
    // Reset computed fields
    computed_rating: null,
    manual_override: null,
    rating: null,
    decision_path: null,
    criteria_snapshot: null,
    needs_review: true
  });
  
  // Clone criteria values with optional transformation
  if (sourceRating.criteria_values?.length) {
    for (const cv of sourceRating.criteria_values) {
      const transformedValue = transformRules 
        ? applyTransformation(cv, transformRules)
        : cv;
      
      if (transformedValue) {
        await criteriaValuesCollection.createOne({
          rating_measure: newRating.id,
          criterion_definition: transformedValue.criterion_definition,
          value_text: transformedValue.value_text,
          value_number: transformedValue.value_number,
          value_boolean: transformedValue.value_boolean,
          value_json: transformedValue.value_json,
          notes: transformedValue.notes
        });
      }
    }
  }
  
  return newRating;
}

/**
 * Apply transformation rules to a criterion value
 * @param {Object} criterionValue - Original criterion value
 * @param {Object} rules - Transformation rules
 * @returns {Object|null} - Transformed value or null if should be skipped
 */
function applyTransformation(criterionValue, rules) {
  if (!rules) return criterionValue;
  
  const criterionKey = typeof criterionValue.criterion_definition === 'object'
    ? criterionValue.criterion_definition.criterion_key
    : criterionValue.criterion_key;
  
  // Check if criterion should be skipped
  if (rules.skip?.includes(criterionKey)) {
    return null;
  }
  
  // Check if criterion should be renamed
  if (rules.rename?.[criterionKey]) {
    criterionValue.criterion_definition = rules.rename[criterionKey];
  }
  
  // Check if value should be mapped
  if (rules.valueMapping?.[criterionKey]) {
    const mapping = rules.valueMapping[criterionKey];
    const currentValue = criterionValue.value_text || criterionValue.value_number;
    
    if (mapping[currentValue] !== undefined) {
      if (typeof mapping[currentValue] === 'number') {
        criterionValue.value_number = mapping[currentValue];
        criterionValue.value_text = null;
      } else {
        criterionValue.value_text = mapping[currentValue];
        criterionValue.value_number = null;
      }
    }
  }
  
  // Apply formula transformation
  if (rules.formulas?.[criterionKey] && criterionValue.value_number !== null) {
    const formula = rules.formulas[criterionKey];
    criterionValue.value_number = evaluateFormula(formula, criterionValue.value_number);
  }
  
  return criterionValue;
}

/**
 * Evaluate a simple formula
 * @param {string} formula - Formula like "value * 1.1" or "value + 10"
 * @param {number} value - Current value
 * @returns {number} - Result
 */
function evaluateFormula(formula, value) {
  // Simple formula evaluation (be careful with eval in production!)
  const sanitized = formula.replace(/value/g, value.toString());
  
  // Only allow basic math operations
  if (!/^[\d\s+\-*/().]+$/.test(sanitized)) {
    throw new Error(`Invalid formula: ${formula}`);
  }
  
  return Function(`"use strict"; return (${sanitized})`)();
}

/**
 * Execute a full catalog migration
 * @param {Object} directus - Directus SDK instance
 * @param {string} migrationId - Migration record ID
 * @returns {Promise<Object>} - Migration result
 */
export async function executeMigration(directus, migrationId) {
  const migrationsCollection = directus.items('catalog_migrations');
  
  // Load migration record
  const migration = await migrationsCollection.readOne(migrationId);
  
  if (!migration) {
    throw new Error(`Migration ${migrationId} not found`);
  }
  
  if (migration.status !== 'pending') {
    throw new Error(`Migration ${migrationId} is not in pending status`);
  }
  
  // Update status to in_progress
  await migrationsCollection.updateOne(migrationId, {
    status: 'in_progress',
    started_at: new Date().toISOString()
  });
  
  const result = {
    successful: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Find ratings to migrate
    const ratingsToMigrate = await findRatingsToMigrate(
      directus, 
      migration.source_version, 
      migration.target_version
    );
    
    // Update affected count
    await migrationsCollection.updateOne(migrationId, {
      affected_ratings_count: ratingsToMigrate.length
    });
    
    // Process each rating
    for (const rating of ratingsToMigrate) {
      try {
        await cloneRating(
          directus, 
          rating, 
          migration.target_version,
          migration.transformation_rules
        );
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          ratingId: rating.id,
          error: error.message
        });
      }
    }
    
    // Update migration record
    await migrationsCollection.updateOne(migrationId, {
      status: result.failed > 0 ? 'completed_with_errors' : 'completed',
      completed_at: new Date().toISOString(),
      successful_migrations: result.successful,
      failed_migrations: result.failed,
      error_log: result.errors.length > 0 ? result.errors : null
    });
    
  } catch (error) {
    // Update migration as failed
    await migrationsCollection.updateOne(migrationId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_log: [{ error: error.message }]
    });
    
    throw error;
  }
  
  return result;
}

/**
 * Rollback a migration
 * @param {Object} directus - Directus SDK instance
 * @param {string} migrationId - Migration record ID
 * @returns {Promise<Object>} - Rollback result
 */
export async function rollbackMigration(directus, migrationId) {
  const migrationsCollection = directus.items('catalog_migrations');
  const ratingsCollection = directus.items('ratings_measures');
  
  const migration = await migrationsCollection.readOne(migrationId);
  
  if (!migration) {
    throw new Error(`Migration ${migrationId} not found`);
  }
  
  // Find ratings created by this migration (ratings in target version that were created after migration started)
  const ratingsToDelete = await ratingsCollection.readByQuery({
    filter: {
      _and: [
        { catalog_version: { _eq: migration.target_version } },
        { date_created: { _gte: migration.started_at } },
        { needs_review: { _eq: true } } // Only delete unreviewed migrated ratings
      ]
    },
    fields: ['id'],
    limit: -1
  });
  
  // Delete the migrated ratings
  let deleted = 0;
  for (const rating of ratingsToDelete) {
    await ratingsCollection.deleteOne(rating.id);
    deleted++;
  }
  
  // Update migration status
  await migrationsCollection.updateOne(migrationId, {
    status: 'rolled_back',
    notes: `${migration.notes}\n\nRolled back: ${deleted} ratings deleted at ${new Date().toISOString()}`
  });
  
  return { deleted };
}

/**
 * Example transformation rules structure:
 * {
 *   skip: ['old_criterion_key'],  // Criteria to not migrate
 *   rename: {
 *     'old_key': 'new_criterion_definition_id'  // Rename criterion
 *   },
 *   valueMapping: {
 *     'criterion_key': {
 *       'old_value': 'new_value'  // Map values
 *     }
 *   },
 *   formulas: {
 *     'criterion_key': 'value * 1.1'  // Apply formula to numeric values
 *   }
 * }
 */

export default {
  createMigration,
  findRatingsToMigrate,
  cloneRating,
  executeMigration,
  rollbackMigration
};
