import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPolicies } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.js';

/**
 * Export roles for Directus v11+
 *
 * In Directus v11, roles no longer hold permissions directly.
 * Instead, roles have policies attached to them via many-to-many relationship.
 * This exports roles with their attached policies (by name reference for portability).
 *
 * The actual policy definitions (with permissions) are exported separately.
 *
 * Note: The Public role is a built-in role that doesn't appear in the roles list
 * by default in Directus v11.17.4+. We need to check the access table for
 * policies attached to the Public role (where role is null).
 *
 * All references (policies, parent, children) are exported by NAME (not ID) to ensure
 * portability across different Directus instances where IDs may differ.
 *
 * The import process resolves these names back to IDs for the target environment.
 */

interface Role {
  id?: string;
  name?: string;
  icon?: string | null;
  description?: string | null;
  parent?: string | null;
  children?: any[];
  policies?: any[];
  users?: any[];
  [key: string]: any;
}

interface Policy {
  id?: string;
  name?: string;
  [key: string]: any;
}

interface AccessEntry {
  role: string | null;
  policy: string;
}

interface ExportRolesOptions {
  verbose?: boolean;
  overwrite?: boolean;
}

async function exportRoles(dest: string, options: ExportRolesOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    // Get all policies to map IDs to names
    const allPolicies: Policy[] = await client.request(readPolicies({ limit: -1 }));

    // Create a map from policy ID to policy name for reference
    const policyIdToName = new Map<string, string>();
    allPolicies.forEach(policy => {
      if (policy.id && policy.name) {
        policyIdToName.set(policy.id, policy.name);
      }
    });

    // Get ALL roles to build a complete mapping of ID to Name for parent/child resolution
    // We include Administrator here to ensure it can be resolved as a parent
    const allRolesForMapping: Role[] = await client.request(readRoles({ limit: -1, fields: ['id', 'name'] }));
    const roleIdToName = new Map<string, string>();
    allRolesForMapping.forEach(r => {
      if (r.id && r.name) {
        roleIdToName.set(r.id, r.name);
      }
    });

    // Get roles to export (excluding Administrator)
    const roles: Role[] = await client.request(
      readRoles({
        limit: -1,
        filter: {
          name: { _neq: "Administrator" },
        },
        fields: ['*', 'policies.*', 'children.*'],
      })
    );

    // Get all access entries to map roles to policies
    // In Directus v11+, roles are connected to policies via the directus_access table.
    // We use the REST API directly since directus_access is a system collection.
    let allAccessEntries: AccessEntry[] = [];
    try {
      const params = new URLSearchParams({
        limit: '-1',
        fields: 'role,policy',
      });
      const response = await fetch(`${directusUrl}/access?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
        },
      });
      const data = (await response.json()) as any;
      allAccessEntries = data.data || [];
    } catch (e: any) {
      if (options.verbose) console.warn('Could not fetch access entries from /access:', e.message);
    }

    // Map role IDs to policy names
    const roleIdToPolicyNames = new Map<string, Set<string>>();
    const publicRolePolicyNames: string[] = [];

    allAccessEntries.forEach(entry => {
      const policyName = policyIdToName.get(entry.policy);
      if (!policyName) return;

      if (entry.role === null) {
        if (!publicRolePolicyNames.includes(policyName)) {
          publicRolePolicyNames.push(policyName);
        }
      } else {
        if (!roleIdToPolicyNames.has(entry.role)) {
          roleIdToPolicyNames.set(entry.role, new Set());
        }
        roleIdToPolicyNames.get(entry.role)!.add(policyName);
      }
    });

    fse.mkdirSync(dest, { recursive: true });

    let exportedCount = 0;

    // Export all roles except Administrator
    roles.forEach((role) => {
      // Handle i18n translation keys - map $t:public_label to 'public'
      let filename = role.name || '';
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

      // Clean up role data for export
      // Convert policy IDs to policy names for portability across environments
      // We primarily use the mapping from directus_access, but fall back to role.policies if available
      const policyNames: string[] = Array.from(roleIdToPolicyNames.get(role.id!) || []);
      const seenPolicyNames = new Set(policyNames);

      for (const p of role.policies || []) {
        const policyId = p.id || p;
        let policyName = policyIdToName.get(policyId);

        // If not found in map, check if policy exists in allPolicies directly
        if (!policyName) {
          const policyObj = allPolicies.find(pol => pol.id === policyId);
          if (policyObj && policyObj.name) {
            policyName = policyObj.name;
          }
        }

        if (policyName && !seenPolicyNames.has(policyName)) {
          policyNames.push(policyName);
          seenPolicyNames.add(policyName);
        }
      }

      // If still no policies found, try heuristic matching by name pattern
      if (policyNames.length === 0) {
        const roleNameLower = (role.name || '').toLowerCase().replace(/[\s-]/g, '');
        const matchingPolicy = allPolicies.find(pol => {
          const polNameLower = (pol.name || '').toLowerCase().replace(/[\s-]/g, '');
          return polNameLower.includes(roleNameLower) || roleNameLower.includes(polNameLower);
        });

        if (matchingPolicy && matchingPolicy.name) {
          const policyName = matchingPolicy.name;
          if (!seenPolicyNames.has(policyName)) {
            policyNames.push(policyName);
            seenPolicyNames.add(policyName);
            if (options.verbose) {
              console.warn(`Role '${role.name}': No policies found in access table. Using heuristic match: '${policyName}'`);
            }
          }
        }
      }

      // Convert child role IDs to child role names for portability across environments
      const childRoleNames: string[] = [];
      const seenChildNames = new Set<string>(); // Track seen child names for deduplication
      const missingChildRoles: string[] = [];

      for (const c of role.children || []) {
        const childId = c.id || c;
        const childName = roleIdToName.get(childId);

        if (childName) {
          // Deduplicate: only add if we haven't seen this child name before
          if (!seenChildNames.has(childName)) {
            childRoleNames.push(childName);
            seenChildNames.add(childName);
          }
        } else {
          missingChildRoles.push(childId);
          if (options.verbose) {
            console.warn(`Role '${role.name}': Child role with ID '${childId}' not found in role list. Skipping.`);
          }
        }
      }

      // Convert parent role ID to parent role name for portability across environments
      let parentRoleName: string | null = null;
      if (role.parent) {
        parentRoleName = roleIdToName.get(role.parent as string) ?? null;
        if (!parentRoleName) {
          if (options.verbose) {
            console.warn(`Role '${role.name}': Parent role with ID '${role.parent}' not found in role list.`);
          }
          parentRoleName = null;
        }
      }

      // Sort policy names for deterministic output
      policyNames.sort();

      const cleanRole: Record<string, any> = {
        name: role.name,
        icon: role.icon || null,
        description: role.description || null,
        parent: parentRoleName,
        children: childRoleNames.length > 0 ? childRoleNames : undefined,
        // Store policy NAMES (not IDs) that are attached to this role
        // These reference policies by name for portability across environments
        policies: policyNames.length > 0 ? policyNames : undefined,
      };

      // Remove null/undefined values for cleaner YAML
      Object.keys(cleanRole).forEach((key) => {
        if (cleanRole[key] === null || cleanRole[key] === undefined) {
          delete cleanRole[key];
        }
      });

      // Remove id field for export
      delete cleanRole.id;
      if (cleanRole.users) delete cleanRole.users;

      fse.writeFileSync(destPath, stringify(cleanRole), { encoding: 'utf8' });
      exportedCount++;

      if (options.verbose) console.info(`Exported role ${destPath}`);
    });

    // Export Public role if it has policies attached
    // The Public role is a built-in role that doesn't appear in the roles list
    // In Directus v11.17.4+, it's represented by null in the directus_access table
    if (publicRolePolicyNames.length > 0) {
      const destPath = path.join(dest, 'public.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists.`);
      } else {
        // Create a Public role with the attached policy names (not IDs)
        const publicRole: Record<string, any> = {
          name: 'Public',
          icon: 'globe',
          description: 'Öffentlicher Zugriff',
          policies: publicRolePolicyNames.sort(),
        };

        // Remove null/undefined values for cleaner YAML
        Object.keys(publicRole).forEach((key) => {
          if (publicRole[key] === null || publicRole[key] === undefined) {
            delete publicRole[key];
          }
        });

        fse.writeFileSync(destPath, stringify(publicRole), { encoding: 'utf8' });
        exportedCount++;

        if (options.verbose) console.info(`Exported Public role ${destPath}`);
      }
    }

    if (options.verbose) {
      console.info(`Exported ${exportedCount} roles.`);
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default exportRoles;
