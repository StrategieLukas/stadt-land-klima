import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { schemaSnapshot } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportSchema(dest, options = {verbose: false, overwrite: false}) {
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
      const destPath = path.join(dest, 'collections', collection.collection + '.yaml');
      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(collection),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported collection ${destPath}`);
      }
    });

    fields.forEach((field) => {
      const destPath = path.join(dest, 'fields', field.collection + '.' + field.field + '.yaml');
      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(field),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported field ${destPath}`);
      }
    });

    relations.forEach((relation) => {
      const destPath = path.join(dest, 'relations', relation.related_collection + '.' + relation.collection + '.' + relation.field + '.yaml');
      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }


      fse.writeFileSync(
        destPath,
        stringify(relation),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported relation ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('Schema exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportSchema;
