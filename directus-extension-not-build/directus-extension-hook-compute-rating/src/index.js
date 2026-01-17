/**
 * Directus Hook: Compute Measure Ratings
 * 
 * This hook automatically computes measure ratings when:
 * 1. A criterion value is created, updated, or deleted
 * 2. A ratings_measures record is created or updated
 * 3. A decision tree is updated
 * 
 * It uses the rating engine to traverse decision trees and compute ratings
 * based on the configured criteria values.
 */

import { 
  computeRating, 
  getEffectiveRating, 
  ratingToValue,
  RATING_LEVELS 
} from './ratingEngine.js';

export default ({ action, filter }, { services, getSchema, logger }) => {
  const adminAccountability = { admin: true };

  /**
   * Load all necessary data to compute a rating
   */
  const loadRatingContext = async (ratingId, schema) => {
    const ratingsService = new services.ItemsService('ratings_measures', {
      schema,
      accountability: adminAccountability
    });

    const criteriaValuesService = new services.ItemsService('rating_criteria_values', {
      schema,
      accountability: adminAccountability
    });

    const criteriaDefinitionsService = new services.ItemsService('rating_criteria_definitions', {
      schema,
      accountability: adminAccountability
    });

    const decisionTreesService = new services.ItemsService('decision_trees', {
      schema,
      accountability: adminAccountability
    });

    // Load the rating
    const rating = await ratingsService.readOne(ratingId, {
      fields: ['id', 'measure_id', 'manual_override', 'decision_tree_version']
    });

    if (!rating) {
      return null;
    }

    const measureId = typeof rating.measure_id === 'object' 
      ? rating.measure_id.id 
      : rating.measure_id;

    // Load criteria values for this rating
    const criteriaValues = await criteriaValuesService.readByQuery({
      limit: -1,
      filter: {
        rating_measure: { _eq: ratingId }
      },
      fields: ['*', 'criterion_definition.*']
    });

    // Load criteria definitions for this measure
    const criteriaDefinitions = await criteriaDefinitionsService.readByQuery({
      limit: -1,
      filter: {
        measure: { _eq: measureId },
        status: { _eq: 'active' }
      },
      fields: ['*']
    });

    // Load decision tree for this measure
    const decisionTrees = await decisionTreesService.readByQuery({
      limit: 1,
      filter: {
        measure: { _eq: measureId },
        is_active: { _eq: true }
      },
      sort: ['-version'],
      fields: ['*']
    });

    const decisionTree = decisionTrees?.[0] || null;

    return {
      rating,
      measureId,
      criteriaValues: criteriaValues || [],
      criteriaDefinitions: criteriaDefinitions || [],
      decisionTree
    };
  };

  /**
   * Compute and save the rating for a ratings_measures record
   */
  const computeAndSaveRating = async (ratingId, schema) => {
    try {
      const context = await loadRatingContext(ratingId, schema);
      
      if (!context) {
        logger.warn(`[computeRating] Rating ${ratingId} not found`);
        return;
      }

      const { rating, criteriaValues, criteriaDefinitions, decisionTree } = context;

      // If no decision tree, we can't compute automatically
      if (!decisionTree) {
        logger.info(`[computeRating] No active decision tree for measure of rating ${ratingId}`);
        return;
      }

      // Compute the rating
      const result = computeRating(decisionTree, criteriaValues, criteriaDefinitions);

      logger.info(`[computeRating] Computed rating for ${ratingId}: ${result.rating} (path: ${result.path?.length || 0} nodes)`);

      if (result.error) {
        logger.warn(`[computeRating] Rating computation warning for ${ratingId}: ${result.error}`);
      }

      // Prepare snapshot of criteria values
      const criteriaSnapshot = criteriaValues.map(cv => ({
        criterion_key: typeof cv.criterion_definition === 'object' 
          ? cv.criterion_definition.criterion_key 
          : cv.criterion_key,
        value_text: cv.value_text,
        value_number: cv.value_number,
        value_boolean: cv.value_boolean,
        value_json: cv.value_json
      }));

      // Update the rating record
      const ratingsService = new services.ItemsService('ratings_measures', {
        schema,
        accountability: adminAccountability
      });

      // Get effective rating considering manual override
      const computedRating = result.rating;
      const effectiveRating = getEffectiveRating(computedRating, rating.manual_override);
      
      // Convert to numeric value for the rating field (existing field)
      const numericRating = ratingToValue(effectiveRating);

      await ratingsService.updateOne(ratingId, {
        computed_rating: computedRating,
        rating: numericRating,
        decision_path: result.path,
        criteria_snapshot: criteriaSnapshot,
        decision_tree_version: decisionTree.version,
        last_computed_at: new Date().toISOString(),
        needs_review: result.error ? true : false
      }, { emitEvents: false }); // Prevent recursive triggers

      logger.info(`[computeRating] Saved rating for ${ratingId}: computed=${computedRating}, effective=${effectiveRating}, numeric=${numericRating}`);

    } catch (error) {
      logger.error(`[computeRating] Error computing rating for ${ratingId}: ${error.message}`);
      throw error;
    }
  };

  /**
   * Find ratings that use a specific criterion definition
   */
  const findRatingsForCriterionValue = async (criterionValueId, schema) => {
    const criteriaValuesService = new services.ItemsService('rating_criteria_values', {
      schema,
      accountability: adminAccountability
    });

    const criterionValue = await criteriaValuesService.readOne(criterionValueId, {
      fields: ['rating_measure']
    });

    if (!criterionValue?.rating_measure) {
      return [];
    }

    const ratingId = typeof criterionValue.rating_measure === 'object'
      ? criterionValue.rating_measure.id
      : criterionValue.rating_measure;

    return [ratingId];
  };

  /**
   * Find all ratings affected by a decision tree change
   */
  const findRatingsForDecisionTree = async (decisionTreeId, schema) => {
    const decisionTreesService = new services.ItemsService('decision_trees', {
      schema,
      accountability: adminAccountability
    });

    const ratingsService = new services.ItemsService('ratings_measures', {
      schema,
      accountability: adminAccountability
    });

    // Get the measure for this decision tree
    const tree = await decisionTreesService.readOne(decisionTreeId, {
      fields: ['measure', 'is_active']
    });

    if (!tree?.measure || !tree.is_active) {
      return [];
    }

    const measureId = typeof tree.measure === 'object' ? tree.measure.id : tree.measure;

    // Find all ratings for this measure
    const ratings = await ratingsService.readByQuery({
      limit: -1,
      filter: {
        measure_id: { _eq: measureId }
      },
      fields: ['id']
    });

    return ratings?.map(r => r.id) || [];
  };

  // ==================== ACTION HOOKS ====================

  // Trigger when a criterion value is created or updated
  action('rating_criteria_values.items.create', async ({ payload, key }, { schema }) => {
    logger.info(`[computeRating] Criterion value created: ${key}`);
    
    const ratingIds = await findRatingsForCriterionValue(key, schema);
    for (const ratingId of ratingIds) {
      await computeAndSaveRating(ratingId, schema);
    }
  });

  action('rating_criteria_values.items.update', async ({ payload, keys }, { schema }) => {
    logger.info(`[computeRating] Criterion values updated: ${keys?.join(', ')}`);
    
    const processedRatings = new Set();
    
    for (const key of (keys || [])) {
      const ratingIds = await findRatingsForCriterionValue(key, schema);
      for (const ratingId of ratingIds) {
        if (!processedRatings.has(ratingId)) {
          processedRatings.add(ratingId);
          await computeAndSaveRating(ratingId, schema);
        }
      }
    }
  });

  action('rating_criteria_values.items.delete', async ({ payload, keys }, { schema }) => {
    logger.info(`[computeRating] Criterion values deleted - ratings may need manual recompute`);
    // Note: After deletion, we can't easily find the associated rating
    // The rating will need to be recomputed manually or when next updated
  });

  // Trigger when a ratings_measures record is created
  action('ratings_measures.items.create', async ({ payload, key }, { schema }) => {
    logger.info(`[computeRating] Rating created: ${key}`);
    
    // Delay slightly to ensure all relations are saved
    setTimeout(async () => {
      try {
        await computeAndSaveRating(key, schema);
      } catch (error) {
        logger.error(`[computeRating] Delayed compute error for ${key}: ${error.message}`);
      }
    }, 500);
  });

  // Trigger when a ratings_measures record is updated (e.g., manual_override changed)
  action('ratings_measures.items.update', async ({ payload, keys }, { schema }) => {
    // Only recompute if relevant fields changed
    const relevantFields = ['manual_override', 'measure_id'];
    const hasRelevantChange = relevantFields.some(field => payload.hasOwnProperty(field));
    
    if (hasRelevantChange) {
      logger.info(`[computeRating] Rating(s) updated with relevant changes: ${keys?.join(', ')}`);
      
      for (const key of (keys || [])) {
        await computeAndSaveRating(key, schema);
      }
    }
  });

  // Trigger when a decision tree is updated
  action('decision_trees.items.update', async ({ payload, keys }, { schema }) => {
    logger.info(`[computeRating] Decision tree(s) updated: ${keys?.join(', ')}`);
    
    for (const treeId of (keys || [])) {
      const ratingIds = await findRatingsForDecisionTree(treeId, schema);
      logger.info(`[computeRating] Recomputing ${ratingIds.length} ratings for decision tree ${treeId}`);
      
      for (const ratingId of ratingIds) {
        await computeAndSaveRating(ratingId, schema);
      }
    }
  });

  // ==================== FILTER HOOKS ====================

  // Validate manual_override is a valid rating level
  filter('ratings_measures.items.create', async (payload) => {
    if (payload.manual_override && !RATING_LEVELS.includes(payload.manual_override)) {
      throw new Error(`Invalid manual_override value: ${payload.manual_override}. Must be one of: ${RATING_LEVELS.join(', ')}`);
    }
    return payload;
  });

  filter('ratings_measures.items.update', async (payload) => {
    if (payload.manual_override && !RATING_LEVELS.includes(payload.manual_override)) {
      throw new Error(`Invalid manual_override value: ${payload.manual_override}. Must be one of: ${RATING_LEVELS.join(', ')}`);
    }
    return payload;
  });

  logger.info('[computeRating] Hook registered successfully');
};
