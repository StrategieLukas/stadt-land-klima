import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { schemaSnapshot } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.js';

interface SchemaSnapshot {
  version: string;
  directus: string;
  vendor: string;
  collections?: any[];
  fields?: any[];
  relations?: any[];
}

interface Collection {
  collection: string;
  [key: string]: any;
}

interface Field {
  collection: string;
  field: string;
  [key: string]: any;
}

interface Relation {
  related_collection: string;
  collection: string;
  field: string;
  [key: string]: any;
}

interface ExportSchemaOptions {
  verbose?: boolean;
  remove?: boolean;
}

async function exportSchema(dest: string, options: ExportSchemaOptions = { verbose: false, remove: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const snapshot: SchemaSnapshot = await client.request(schemaSnapshot());
    const header = {
      version: snapshot.version,
      directus: snapshot.directus,
      vendor: snapshot.vendor,
    };
    const collections: Collection[] = (snapshot.collections || []).sort((a, b) =>
      a.collection.localeCompare(b.collection)
    );
    const fields: Field[] = (snapshot.fields || []).sort((a, b) => {
      if (a.collection === b.collection) return a.field.localeCompare(b.field);
      return a.collection.localeCompare(b.collection);
    });
    const relations: Relation[] = (snapshot.relations || []).sort((a, b) => {
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
      path.join(dest, 'header.yaml'),
      stringify(header),
      { encoding: 'utf8' }
    );

    let exportedCollections = 0;
    let exportedFields = 0;
    let exportedRelations = 0;

    collections.forEach((collection) => {
      const destPath = path.join(
        dest,
        'collections',
        collection.collection + '.yaml'
      );
      fse.writeFileSync(destPath, stringify(collection), { encoding: 'utf8' });
      exportedCollections++;
      if (options.verbose) console.info(`Exported collection ${destPath}`);
    });

    fields.forEach((field) => {
      const fieldDir = path.join(dest, 'fields', field.collection);
      fse.mkdirSync(fieldDir, { recursive: true });
      const destPath = path.join(fieldDir, field.field + '.yaml');
      fse.writeFileSync(destPath, stringify(field), { encoding: 'utf8' });
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
          '.yaml'
      );
      fse.writeFileSync(destPath, stringify(relation), { encoding: 'utf8' });
      exportedRelations++;
      if (options.verbose) console.info(`Exported relation ${destPath}`);
    });

    if (options.verbose) {
      console.info(
        `Schema exported: ${exportedCollections} collections, ${exportedFields} fields, ${exportedRelations} relations`
      );
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default exportSchema;
