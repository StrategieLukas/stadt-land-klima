import fse from 'fse';
import path from 'path';
import { parse } from 'yaml';
import { schemaDiff, schemaApply } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function importSchema(src, verbose = false) {
  function readYamlFiles(dir) {
    const yamls = [];

    fse.readdirSync(dir)
    .forEach((filename) => {
      if (path.extname(filename).toLowerCase() === '.yaml') {
        const yaml = parse(fse.readFileSync(path.join(dir, filename), { encoding: 'utf8' }));
        yamls.push(yaml);
      }
    });

    return yamls;
  }

  const client = createDirectusClient();

  try {
    const header = parse(fse.readFileSync(path.join(src, 'header.yaml'), { encoding: 'utf8' }));
    const collections = readYamlFiles(path.join(src, 'collections'));
    const fields = readYamlFiles(path.join(src, 'fields'));
    const relations = readYamlFiles(path.join(src, 'relations'));
    const schema = Object.assign({}, header, {
      collections: collections,
      fields: fields,
      relations: relations,
    });

    if (verbose) {
      console.info('Applying schema:');
      console.info(schema);
    }

    const diff = await client.request(schemaDiff(schema));

    if (!diff) {
      if (verbose) {
        console.info('No difference. Done');
      }
      return;
    }

    if (verbose) {
      console.info('Applying diff:');
      console.info(diff);
    }

    const result = await client.request(schemaApply(diff));

    if (verbose) {
      console.info('Finished');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSchema;
