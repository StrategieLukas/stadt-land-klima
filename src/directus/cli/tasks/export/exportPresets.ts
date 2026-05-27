import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readPresets, readRoles } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.js';

interface Preset {
  id?: string;
  collection: string;
  role?: string;
  user?: string;
  [key: string]: any;
}

interface Role {
  id: string;
  name: string;
}

interface ExportPresetsOptions {
  verbose?: boolean;
  overwrite?: boolean;
}

async function exportPresets(dest: string, options: ExportPresetsOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    // Fetch all presets
    const presets: Preset[] = await client.request(readPresets({ limit: -1 }));

    // Fetch all roles to map role IDs to names
    const roles: Role[] = await client.request(readRoles({ limit: -1 }));
    const roleMap: Record<string, string> = Object.fromEntries(roles.map(r => [r.id, r.name]));

    fse.mkdirSync(dest, { recursive: true });

    for (const preset of presets) {
      // Skip user-specific presets
      if (preset.user) continue;

      // Remove ID from export
      const { id, ...presetData } = preset;

      // Determine filename
      let filename = '';
      if (!preset.role) {
        // Global default
        filename = slugify(preset.collection, { replacement: '_', lower: false }) + '.yaml';
      } else {
        // Role-specific default
        const roleName = roleMap[preset.role] || preset.role;
        filename =
          slugify(`${preset.collection}-${roleName}`, { replacement: '_', lower: false }) +
          '.yaml';
      }

      const destPath = path.join(dest, filename);

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists. Skipping.`);
        continue;
      }

      fse.writeFileSync(destPath, stringify(presetData), { encoding: 'utf8' });

      if (options.verbose) {
        console.info(`Exported preset to ${destPath}`);
      }
    }

    if (options.verbose) console.info('All eligible presets exported.');
  } catch (err: any) {
    console.error('Error exporting presets:', err);
    process.exit(1);
  }
}

export default exportPresets;
