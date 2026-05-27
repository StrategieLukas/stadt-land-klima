import path from 'path';
import { schemaDiff, schemaApply } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readHoconFiles from '../shared/readHoconFiles.mjs';
import readHoconFile from '../shared/readHoconFile.mjs';

async function importSchema(src, options = {verbose: false}) {
  const client = createDirectusClient();

  try {
    const header = await readHoconFile(path.join(src, 'header.hocon'));
    const collections = await readHoconFiles(path.join(src, 'collections'));
    const fields = await readHoconFiles(path.join(src, 'fields'));
    const relations = await readHoconFiles(path.join(src, 'relations'));
    const schema = Object.assign({}, header, {
      collections: collections,
      fields: fields,
      relations: relations,
    });

    if (options.verbose) {
      console.info('Applying schema...');
    }

    // Use REST API directly for schema operations
    let diffUrl = new URL('/schema/diff?force=true', client.url).toString();
    let applyUrl = new URL('/schema/apply?force=true', client.url).toString();
    
    // First, try schema/diff
    const diffResponse = await fetch(diffUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
      },
      body: JSON.stringify(schema),
    });

    if (!diffResponse.ok) {
      const errorText = await diffResponse.text();
      console.error('Schema diff error:', diffResponse.status, errorText);
      return process.exit(1);
    }

    let diffData;
    const responseText = await diffResponse.text();
    
    // Handle 204 No Content (schema already matches)
    if (diffResponse.status === 204 || !responseText.trim()) {
      if (options.verbose) {
        console.info('No schema differences. Done.');
      }
      return;
    }

    try {
      diffData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse schema diff response:', e.message);
      console.error('Response status:', diffResponse.status);
      console.error('Response body:', responseText.substring(0, 500));
      return process.exit(1);
    }

    const diff = diffData.data;

    // If no differences, exit early
    if (!diff) {
      if (options.verbose) {
        console.info('No schema differences. Done.');
      }
      return;
    }

    if (options.verbose) {
      console.info('Schema differences found. Applying...');
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
      const errorText = await applyResponse.text();
      console.error('Schema apply error:', applyResponse.status, errorText);
      return process.exit(1);
    }

    // Handle 204 No Content for apply as well
    const applyText = await applyResponse.text();
    if (applyResponse.status !== 204 && applyText.trim()) {
      try {
        const applyData = JSON.parse(applyText);
        if (options.verbose) {
          console.info('Schema apply response:', applyData);
        }
      } catch (e) {
        // Non-JSON response is OK
      }
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
