/**
 * Resolves a localteam ID from multiple possible sources:
 * 1. Explicitly passed option
 * 2. Flow trigger body (collection + keys)
 * 3. Current user's junction table entry
 *
 * @param {string|null} localteam_id - Explicitly provided ID (may be null/undefined)
 * @param {object} accountability
 * @param {object} data - Flow data containing $trigger
 * @param {Function} ItemsService
 * @param {object} schema
 * @returns {Promise<string>} Resolved localteam ID
 * @throws {Error} If no localteam can be resolved
 */
export async function resolveLocalteamId(localteam_id, accountability, data, ItemsService, schema) {
  const systemAccountability = { ...accountability, admin: true };
  let resolved_id = localteam_id || null;

  // 1. Try to resolve from flow trigger body
  if (!resolved_id && data?.$trigger?.body) {
    const { collection, keys } = data.$trigger.body;
    if (keys && keys.length > 0) {
      const id = keys[0];
      if (collection === 'localteams') {
        resolved_id = id;
      } else if (collection) {
        try {
          const service = new ItemsService(collection, { schema, accountability: systemAccountability });
          const item = await service.readOne(id, { fields: ['localteam'] });
          if (item?.localteam) resolved_id = item.localteam;
        } catch (e) {
          // Collection may not have a localteam field — fall through
        }
      }
    }
  }

  // 2. Fall back to the current user's localteam via junction table
  if (!resolved_id && accountability?.user) {
    const junctionService = new ItemsService('junction_directus_users_localteams', {
      schema,
      accountability: systemAccountability,
    });
    const junctions = await junctionService.readByQuery({
      filter: { directus_users_id: { _eq: accountability.user } },
      limit: 1,
    });
    if (junctions?.length > 0) {
      resolved_id = junctions[0].localteam_id;
    }
  }

  if (!resolved_id) {
    throw new Error('Konnte kein Lokalteam identifizieren.');
  }

  return resolved_id;
}
