import readline from 'readline';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import { readItems, updateItem } from '@directus/sdk';

async function migrateRatings(oldVersion, newVersion) {
  if (!oldVersion || !newVersion) {
    console.error('❌ Missing arguments: migrateRatings(oldVersion, newVersion)');
    console.error('Example: migrateRatings("beta", "v1.0")');
    process.exit(1);
  }

  const client = createDirectusClient();

  // ✅ Confirm action
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise((resolve) => {
    rl.question(
      `⚠️  This will copy ratings from "${oldVersion}" → "${newVersion}".\n` +
        `Are you absolutely sure you want to continue? (yes/no): `,
      (answer) => resolve(answer.trim().toLowerCase())
    );
  });
  rl.close();
  if (confirm !== 'yes') {
    console.log('🛑 Aborted by user.');
    process.exit(0);
  }

  console.log(`\n🚀 Starting migration: ${oldVersion} → ${newVersion}`);
  const startTime = Date.now();

  try {
    console.log('📥 Fetching measure catalog versions...');

    // ✅ Validate both catalog versions exist
    const catalogs = await client.request(
      readItems('measure_catalog', {
        filter: { name: { _in: [oldVersion, newVersion] } },
        fields: ['id', 'name', 'is_active'],
      })
    );

    const oldCatalog = catalogs.find((c) => c.name === oldVersion);
    const newCatalog = catalogs.find((c) => c.name === newVersion);

    if (!oldCatalog || !newCatalog) {
      console.error(
        `❌ Version(s) not found in measure_catalogs: missing ${[
          !oldCatalog ? oldVersion : '',
          !newCatalog ? newVersion : '',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
      process.exit(1);
    }

    console.log(
      `📚 Found catalog entries: ${oldCatalog.name} (id=${oldCatalog.id}), ${newCatalog.name} (id=${newCatalog.id})`
    );

    console.log('📥 Fetching measures...');
    const [oldMeasures, newMeasures] = await Promise.all([
      client.request(
        readItems('measures', {
          filter: { catalog: { _eq: oldCatalog.id }, status: { _eq: 'published' } },
          fields: ['id', 'measure_id'],
          limit: -1,
        })
      ),
      client.request(
        readItems('measures', {
          filter: { catalog: { _eq: newCatalog.id }, status: { _eq: 'published' } },
          fields: ['id', 'measure_id', 'must_be_rated_again'],
          limit: -1,
        })
      ),
    ]);

    console.log(
      `📊 Measures loaded: ${oldMeasures.length} (${oldVersion}) | ${newMeasures.length} (${newVersion})`
    );

    const oldMap = new Map(oldMeasures.map((m) => [m.measure_id, m]));
    const newMap = new Map(newMeasures.map((m) => [m.measure_id, m]));
    const commonMeasureIds = [...oldMap.keys()].filter((id) => newMap.has(id));

    console.log(
      `🔗 Found ${commonMeasureIds.length} measures existing in both catalogs:\n  ${commonMeasureIds.join(', ')}`
    );

    let updatedCount = 0;

    for (const measureId of commonMeasureIds) {
      const oldMeasure = oldMap.get(measureId);
      const newMeasure = newMap.get(measureId);

      console.log(`\n➡️ Processing measure "${measureId}"`);

      const oldRatings = await client.request(
        readItems('ratings', {
          filter: { measure: { _eq: oldMeasure.id } },
          fields: [
            'id',
            'localteam_id',
            'internal_note',
            'status',
            'applicable',
            'why_not_applicable',
            'rating',
            'current_progress',
            'source',
          ],
          limit: -1,
        })
      );

      const newRatings = await client.request(
        readItems('ratings', {
          filter: { measure: { _eq: newMeasure.id } },
          fields: ['id', 'localteam_id'],
          limit: -1,
        })
      );

      console.log(`   🧮 ${oldRatings.length} old → ${newRatings.length} new ratings`);
      const newByLocalteam = new Map(newRatings.map((r) => [r.localteam_id, r]));
      const mustBeRatedAgain = !!newMeasure.must_be_rated_again;

      let updatedForThisMeasure = 0;

      for (const oldRating of oldRatings) {
        const target = newByLocalteam.get(oldRating.localteam_id);
        if (!target) continue;

        const updateData = mustBeRatedAgain
          ? { internal_note: oldRating.internal_note }
          : {
              internal_note: oldRating.internal_note,
              status: oldRating.status,
              applicable: oldRating.applicable,
              why_not_applicable: oldRating.why_not_applicable,
              rating: oldRating.rating,
              current_progress: oldRating.current_progress,
              source: oldRating.source,
            };

        try {
          await client.request(updateItem('ratings', target.id, updateData));
          updatedForThisMeasure++;
          updatedCount++;
        } catch (err) {
          console.error(
            `   ❌ Failed to update rating for localteam ${oldRating.localteam_id}: ${err.message}`
          );
        }
      }

      console.log(`   ✅ Updated ${updatedForThisMeasure} ratings for measure "${measureId}"`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 Migration complete: ${updatedCount} ratings updated in ${elapsed}s`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

export default migrateRatings;
