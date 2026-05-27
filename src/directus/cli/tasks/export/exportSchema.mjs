import fse from 'fse';
import path from 'path';
import stringifyHocon from '../shared/stringifyHocon.mjs';
import { schemaSnapshot } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportSchema(dest, options = { verbose: false, remove: false }) {
  const client = createDirectusClient();

  try {
    const snapshot = await client.request(schemaSnapshot());
    const header = {
      version: snapshot.version,
      directus: snapshot.directus,
      vendor: snapshot.vendor,
    };
    const collections = (snapshot.collections || []).sort((a, b) =>
      a.collection.localeCompare(b.collection)
    );
    const fields = (snapshot.fields || []).sort((a, b) => {
      if (a.collection === b.collection) return a.field.localeCompare(b.field);
      return a.collection.localeCompare(b.collection);
    });
    const relations = (snapshot.relations || []).sort((a, b) => {
      if (a.related_collection === b.related_collection) {
        if (a.collection === b.collection) {
          return (a.field || '').localeCompare(b.field || '');
        }
        return a.collection.localeCompare(b.collection);
      }
      return a.related_collection.localeCompare(b.related_collection);
    });

    fse.mkdirSync(dest, { recursive: true });
    fse.mkdirSync(path.join(dest, 'collections'), { recursive: true });
    fse.mkdirSync(path.join(dest, 'fields'), { recursive: true });
    fse.mkdirSync(path.join(dest, 'relations'), { recursive: true });

    fse.writeFileSync(
      path.join(dest, 'header.hocon'),
      stringifyHocon(header),
      { encoding: 'utf8' }
    );

    let exportedCollections = 0;
    let exportedFields = 0;
    let exportedRelations = 0;

    collections.forEach((collection) => {
      const destPath = path.join(
        dest,
        'collections',
        collection.collection + '.hocon'
      );
      fse.writeFileSync(destPath, stringifyHocon(collection), { encoding: 'utf8' });
      exportedCollections++;
      if (options.verbose) console.info(`Exported collection ${destPath}`);
    });

    fields.forEach((field) => {
      const fieldDir = path.join(dest, 'fields', field.collection);
      fse.mkdirSync(fieldDir, { recursive: true });
      const destPath = path.join(fieldDir, field.field + '.hocon');
      fse.writeFileSync(destPath, stringifyHocon(field), { encoding: 'utf8' });
      exportedFields++;
      if (options.verbose) console.info(`Exported field ${destPath}`);
    });

    relations.forEach((relation) => {
      const destPath = path.join(
        dest,
        'relations',
        relation.related_collection +
          '.' +
          relation.collection +
          '.' +
          relation.field +
          '.hocon'
      );
      fse.writeFileSync(destPath, stringifyHocon(relation), { encoding: 'utf8' });
      exportedRelations++;
      if (options.verbose) console.info(`Exported relation ${destPath}`);
    });

    if (options.verbose) {
      console.info(
        `Schema exported: ${exportedCollections} collections, ${exportedFields} fields, ${exportedRelations} relations`
      );
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportSchema;
