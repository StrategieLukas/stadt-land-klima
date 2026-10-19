import { assert } from '../lib/assert.js';
import type { JsonRecord } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';

export async function runRatingsImportExportFlow(runner: TestRunner, fixture: TestFixture): Promise<void> {
  await runner.step('Ratings: shared export bookmark round-trips UUID relations and numeric, string and null ratings', async () => {
    const presets = await fixture.admin.request<{
      user: string | null;
      role: string | null;
      layout_query: { tabular: { fields: string[] } };
    }[]>('GET', '/presets', {
      query: {
        filter: JSON.stringify({
          collection: { _eq: 'ratings_measures' },
          bookmark: { _eq: '$t:measure_rating.import_export' },
          user: { _null: true },
          role: { _null: true },
        }),
      },
    });
    assert(presets.length === 1, 'Exactly one global import/export bookmark must exist');
    const fields = presets[0]!.layout_query.tabular.fields;
    assert(fields.includes('id'), 'Export must include the rating primary key');
    assert(fields.includes('measure_id') && fields.includes('localteam_id'), 'Export must include UUID relations');
    assert(fields.every((field) => !field.includes('.')), 'Export must not expand relations into writable objects');
    assert(!fields.includes('approved') && !fields.includes('user_updated'), 'Export must omit approval and audit metadata');

    const values = [0, 0.25, 0.5, 0.75, 1, '0', '0.25', '0.5', '0.75', '1', null];
    const original = await fixture.admin.request<JsonRecord[]>('GET', '/items/ratings_measures', {
      query: {
        export: 'json',
        fields: fields.join(','),
        filter: JSON.stringify({ localteam_id: { _eq: fixture.localteam.id } }),
        sort: 'id',
        limit: values.length,
      },
    });
    assert(original.length === values.length, 'Fixture must contain enough ratings for every supported value');
    for (const row of original) {
      assert(typeof row.measure_id === 'string', 'Exported measure relation must be a UUID string');
      assert(row.localteam_id === fixture.localteam.id, 'Exported localteam relation must be its UUID');
    }

    try {
      await fixture.admin.importJsonItems('ratings_measures', original.map((row, index) => ({
        ...row,
        rating: values[index],
        current_progress: `Import regression ${fixture.config.runId}`,
        source: `https://stadt-land-klima.de/automated-test/${fixture.config.runId}`,
        internal_note: `Import note ${index}`,
      })));
      const saved = await fixture.admin.readItems<JsonRecord>('ratings_measures', {
        fields,
        filter: { id: { _in: original.map((row) => row.id) } },
        sort: ['id'],
        limit: -1,
      });
      assert(saved.length === original.length, 'Import must update existing ratings');
      saved.forEach((row, index) => {
        const value = values[index];
        assert(row.rating === (value === null ? null : String(value)), 'Ratings must persist as canonical strings or null');
        assert(row.measure_id === original[index]!.measure_id, 'Import must preserve the linked measure');
        assert(row.localteam_id === fixture.localteam.id, 'Import must preserve the linked localteam');
        assert(row.internal_note === `Import note ${index}`, 'Import must save the edited note');
      });

      let rejected = false;
      try {
        await fixture.admin.importJsonItems('ratings_measures', [{ id: original[0]!.id, rating: 0.3 }]);
      } catch {
        rejected = true;
      }
      assert(rejected, 'Import must still reject unsupported rating values');
      const afterRejection = await fixture.admin.readItem<JsonRecord>('ratings_measures', String(original[0]!.id), ['rating']);
      assert(afterRejection.rating === '0', 'Rejected import must not overwrite the saved rating');
    } finally {
      await fixture.admin.importJsonItems('ratings_measures', original);
    }
  });
}
