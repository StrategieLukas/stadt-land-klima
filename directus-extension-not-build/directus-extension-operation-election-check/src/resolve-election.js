/**
 * Resolves an election ID from multiple possible sources (in priority order):
 *   1. Explicitly passed option value
 *   2. Flow trigger body (collection === 'elections', keys[0])
 *   3. Flow trigger body (other collection with an 'election' field)
 *
 * Unlike the old localteam resolver, we no longer fall back to the current
 * user — everything is scoped to a specific election record.
 *
 * @throws {Error} if no election ID can be resolved
 */
export async function resolveElectionId(election_id, data, ItemsService, schema, accountability) {
  const sysAcc = { ...accountability, admin: true };
  let resolved = election_id || null;

  if (!resolved && data?.$trigger?.body) {
    const { collection, keys } = data.$trigger.body;
    if (keys?.length > 0) {
      const id = keys[0];
      if (collection === 'elections') {
        resolved = id;
      } else if (collection) {
        try {
          const svc = new ItemsService(collection, { schema, accountability: sysAcc });
          const item = await svc.readOne(id, { fields: ['election'] });
          if (item?.election) resolved = item.election;
        } catch {
          // collection may not have an election field — fall through
        }
      }
    }
  }

  if (!resolved) throw new Error('Konnte keine Wahl (election) identifizieren.');
  return resolved;
}
