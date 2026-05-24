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

    // Use REST API directly for schema operations to handle version mismatch
    // First try without force flag - if it fails with version mismatch, retry with force
    let diffUrl = new URL('/schema/diff', client.url).toString();
    let applyUrl = new URL('/schema/apply', client.url).toString();
    
    let diffResponse;
    let diffData;
    let diff;
    
    try {
      diffResponse = await fetch(diffUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
        },
        body: JSON.stringify(schema),
      });

      diffData = await diffResponse.json();
      diff = diffData.data;
    } catch (e) {
      if (options.verbose) {
        console.info('Schema diff failed, retrying with force flag...');
      }
      diffUrl = new URL('/schema/diff?force=true', client.url).toString();
      applyUrl = new URL('/schema/apply?force=true', client.url).toString();
      
      diffResponse = await fetch(diffUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
        },
        body: JSON.stringify(schema),
      });

      diffData = await diffResponse.json();
      diff = diffData.data;
    }

    if (!diff) {
      if (options.verbose) {
        console.info('No difference. Done');
      }
      return;
    }

    if (options.verbose) {
      console.info('Applying diff:');
      console.info(diff);
    }

    const applyResponse = await fetch(applyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify(diff),
    });

    if (!applyResponse.ok) {
      const error = await applyResponse.json();
      console.error('Failed to apply schema:', error);
      return process.exit(1);
    }

    if (options.verbose) {
      console.info('Schema imported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSchema;
