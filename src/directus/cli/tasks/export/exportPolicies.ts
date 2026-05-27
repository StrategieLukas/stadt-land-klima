import fs from 'fs';
import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readPolicies, readPermissions } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.js';

/**
 * Export policies and their permissions for Directus v11+
 *
 * In Directus v11, permissions are attached to POLICIES, not directly to roles.
 * This exports policies with their associated permissions.
 */

interface Policy {
  id?: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  ip_access?: any | null;
  enforce_tfa?: boolean;
  admin_access?: boolean;
  app_access?: boolean;
  permissions?: any[];
  [key: string]: any;
}

interface Permission {
  id?: string;
  policy?: string;
  [key: string]: any;
}

interface ExportPoliciesOptions {
  verbose?: boolean;
  overwrite?: boolean;
}

async function exportPolicies(dest: string, options: ExportPoliciesOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    // Get all policies (excluding admin policies if needed)
    const policies: Policy[] = await client.request(
      readPolicies({
        limit: -1,
        fields: ['*', 'permissions.*'],
      })
    );

    // Get all permissions to find those attached to policies
    const allPermissions: Permission[] = await client.request(readPermissions({ limit: -1 }));

    fs.mkdirSync(dest, { recursive: true });

    let exportedCount = 0;

    // Export each policy with its permissions
    policies.forEach((policy) => {
      // Skip system/admin policies if they have admin_access true
      // as these are typically auto-generated
      if (policy.admin_access === true) {
        if (options.verbose) console.info(`Skipping admin policy: ${policy.name}`);
        return;
      }

      // Handle i18n translation keys - map $t:public_label to 'public'
      let filename = policy.name;
      if (filename === '$t:public_label') {
        filename = 'public';
      } else if (filename.startsWith('$t:')) {
        // For other translation keys, strip the $t: prefix and slugify
        filename = filename.substring(3);
      }
      const destPath = path.join(dest, slugify(filename, { replacement: '_', lower: false }) + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists.`);
        return;
      }

      // Get permissions for this policy
      const policyPermissions = allPermissions.filter(
        (permission) => permission.policy === policy.id
      );

      // Clean up policy data for export
      // Note: We explicitly use NAME (not ID) as the unique identifier for portability
      const cleanPolicy: Record<string, any> = {
        name: policy.name,
        icon: policy.icon || null,
        description: policy.description || null,
        ip_access: policy.ip_access || null,
        enforce_tfa: policy.enforce_tfa || false,
        admin_access: policy.admin_access || false,
        app_access: policy.app_access !== undefined ? policy.app_access : true,
        permissions: policyPermissions.map((permission) => {
          // Remove internal fields for export
          const cleanPermission = { ...permission };
          delete cleanPermission.id;
          delete cleanPermission.policy;
          return cleanPermission;
        }).sort((a: any, b: any) => {
          // Sort by collection then action for deterministic order
          if (a.collection === b.collection) {
            return a.action < b.action ? -1 : 1;
          }
          return a.collection < b.collection ? -1 : 1;
        }),
      };

      // Remove null/undefined values for cleaner YAML
      Object.keys(cleanPolicy).forEach((key) => {
        if (cleanPolicy[key] === null || cleanPolicy[key] === undefined) {
          delete cleanPolicy[key];
        }
      });

      // Explicitly remove id field to ensure no UUIDs are exported (use name as identifier)
      delete cleanPolicy.id;

      fs.writeFileSync(destPath, stringify(cleanPolicy), { encoding: 'utf8' });
      exportedCount++;

      if (options.verbose) console.info(`Exported policy ${destPath}`);
    });

    if (options.verbose) {
      console.info(`Exported ${exportedCount} policies.`);
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default exportPolicies;
