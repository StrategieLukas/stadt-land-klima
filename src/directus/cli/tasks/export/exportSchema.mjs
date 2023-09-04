import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { schemaSnapshot } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportSchema(dest, verbose = false) {
  const client = createDirectusClient();

  try {
    const snapshot = await client.request(schemaSnapshot());
    const header = {
      version: snapshot.version,
      directus: snapshot.directus,
      vendor: snapshot.vendor,
    };
    const collections = snapshot.collections || [];
    const fields = snapshot.fields || [];
    const relations = snapshot.relations || [];

    fse.mkdirSync(dest);
    fse.mkdirSync(path.join(dest, 'collections'));
    fse.mkdirSync(path.join(dest, 'fields'));
    fse.mkdirSync(path.join(dest, 'relations'));

    fse.writeFileSync(
      path.join(dest, 'header.yaml'),
      stringify(header),
      { encoding: 'utf8' }
    );

    collections.forEach((collection) => {
      fse.writeFileSync(
        path.join(dest, 'collections', collection.collection + '.yaml'),
        stringify(collection),
        { encoding: 'utf8' }
      );
    });

    fields.forEach((field) => {
      fse.writeFileSync(
        path.join(dest, 'fields', field.collection + '.' + field.field + '.yaml'),
        stringify(field),
        { encoding: 'utf8' }
      );
    });

    relations.forEach((relation) => {
      fse.writeFileSync(
        path.join(dest, 'relations', relation.related_collection + '.' + relation.collection + '.' + relation.field + '.yaml'),
        stringify(relation),
        { encoding: 'utf8' }
      );
    });
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportSchema;
