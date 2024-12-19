import path from 'path';
import { schemaDiff, schemaApply } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';
import readYamlFile from '../shared/readYamlFile.mjs';

async function importSchema(src, options = {verbose: false}) {
  const client = createDirectusClient();

  try {
    const header = readYamlFile(path.join(src, 'header.yaml'));
    const collections = readYamlFiles(path.join(src, 'collections'));
    const fields = readYamlFiles(path.join(src, 'fields'));
    const relations = readYamlFiles(path.join(src, 'relations'));
    const schema = Object.assign({}, header, {
      collections: collections,
      fields: fields,
      relations: relations,
    });

    if (options.verbose) {
      console.info('Applying schema:');
      console.info(schema);
    }

    const diff = await client.request(schemaDiff(schema));

    if (!diff || !diff.diff) {
      if (options.verbose) {
        console.info('No difference. Done');
      }
      return;
    }

    if (options.verbose) {
      console.info('Applying diff:');
      console.info(diff);
    }

    const result = await client.request(schemaApply(diff));

    if (options.verbose) {
      console.info('Schema imported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSchema;
