import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPolicies } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.mjs';

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
async function exportRoles(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(
      readRoles({
        limit: -1,
        filter: {
          name: { _neq: "Administrator" },
        },
        fields: ['*', 'policies.*', 'users.*', 'children.*'],
      })
    );

    // Get all policies to map IDs to names
    const allPolicies = await client.request(readPolicies({ limit: -1 }));
    
    // Create a map from policy ID to policy name for reference
    const policyIdToName = new Map();
    allPolicies.forEach(policy => {
      if (policy.id && policy.name) {
        policyIdToName.set(policy.id, policy.name);
      }
    });

    // Create a map from role ID to role name for children references
    const roleIdToName = new Map();
    roles.forEach(r => {
      if (r.id && r.name) {
        roleIdToName.set(r.id, r.name);
      }
    });

    // Get access entries for the Public role (role is null)
    // In Directus v11.17.4+, the Public role is represented by null in the directus_access table
    // We use the REST API directly since directus_access is a system collection
    // Build the URL with query parameters for the REST API
    const buildAccessUrl = (filters) => {
      const params = new URLSearchParams({
        limit: -1,
        fields: 'policy',
      });
      
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          params.append(key, 'null');
        } else {
          params.append(key, value);
        }
      }
      
      return `/access?${params.toString()}`;
    };

    let accessEntries = [];
    try {
      // Try to get access entries where role is null (Public role)
      const url = buildAccessUrl({ 'filter[role][_null]': 'true' });
      const response = await fetch(`${directusUrl}${url}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
        },
      });
      const data = await response.json();
      accessEntries = data.data || [];
    } catch (e) {
      if (options.verbose) console.info('Could not fetch access entries for Public role (role=null):', e.message);
    }

    // Extract policy IDs for the Public role
    const publicRolePolicyIds = accessEntries
      .map(entry => entry.policy)
      .filter((id, index, self) => id && self.indexOf(id) === index); // Deduplicate and filter out null/undefined

    // Convert policy IDs to policy names for portability
    const publicRolePolicyNames = publicRolePolicyIds
      .map(id => policyIdToName.get(id))
      .filter(name => name !== undefined); // Only include policies that were found

    fse.mkdirSync(dest, { recursive: true });

    let exportedCount = 0;

    // Export all roles except Administrator
    roles.forEach((role) => {
      // Handle i18n translation keys - map $t:public_label to 'public'
      let filename = role.name;
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
      // Known mappings for orphaned policy references (old UUID -> new policy name)
      // These handle cases where policies were re-created with new UUIDs
      const knownPolicyMappings = {
        '133d443a-7700-41a8-8bf2-640b78c51312': 'Lokalteam-Mitglied',
        '4ae88595-f0cf-40b0-bc1b-226b88a41a75': 'App-Zugriff-Minimum',
        'dcef91fd-ae94-4e34-9b0e-f337e6d7769d': 'App-Zugriff-Minimum',
        '89ec9b80-b7c0-425c-a91c-f2b19e153c5c': 'API-StadtLandZahl',
        '15b25042-6c99-4e06-97eb-b51b07ee185c': 'policy-adminlokalteam',
        'f7f6b333-90f0-4f03-9859-0b598d5e5331': 'policy-editorlocalteam',
        'bada4cf0-e009-4754-b4a0-2ff07b74414b': 'Frontend',
      };
      
      const policyNames = new Set(); // Use Set to avoid duplicates
      const missingPolicies = [];
      
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
        
        // If still not found, check known mappings
        if (!policyName) {
          policyName = knownPolicyMappings[policyId];
          if (policyName && options.verbose) {
            console.info(`Role '${role.name}': Policy ID '${policyId}' mapped using known mapping: '${policyName}'`);
          }
        }
        
        if (policyName) {
          policyNames.add(policyName);
        } else {
          // Policy truly not found - try heuristic matching by name pattern
          // For example, LocalteamMember -> Lokalteam-Mitglied
          // Try multiple matching strategies:
          
          // Strategy 1: Exact name match (case-insensitive)
          let matchingPolicy = allPolicies.find(pol => 
            pol.name && role.name && pol.name.toLowerCase() === role.name.toLowerCase()
          );
          
          // Strategy 2: Name contains role name or vice versa (case-insensitive, no special chars)
          if (!matchingPolicy) {
            const roleNameClean = (role.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            matchingPolicy = allPolicies.find(pol => {
              const polNameClean = (pol.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              return polNameClean.includes(roleNameClean) || roleNameClean.includes(polNameClean);
            });
          }
          
          // Strategy 3: Fuzzy keyword matching
          // Handle cases like "LocalteamMember" -> "Lokalteam-Mitglied"
          // where spelling differs (local vs lokal)
          if (!matchingPolicy) {
            const roleNameLower = (role.name || '').toLowerCase();
            const roleParts = roleNameLower.split(/[\s-]/).filter(k => k.length > 2);
            
            matchingPolicy = allPolicies.find(pol => {
              const polNameLower = (pol.name || '').toLowerCase();
              const polParts = polNameLower.split(/[\s-]/).filter(k => k.length > 2);
              
              // Check if any role part matches any policy part (with some flexibility)
              return roleParts.some(rp => 
                polParts.some(pp => 
                  rp === pp || 
                  rp.includes(pp) || 
                  pp.includes(rp) ||
                  // Handle local vs lokal
                  (rp.includes('local') && pp.includes('lokal')) ||
                  (rp.includes('lokal') && pp.includes('local')) ||
                  // Handle member vs mitglied
                  (rp.includes('member') && pp.includes('mitglied')) ||
                  (rp.includes('mitglied') && pp.includes('member'))
                )
              );
            });
          }
          
          // Strategy 4: Desperate - use any policy with similar purpose based on icon or description
          if (!matchingPolicy) {
            // This is a last resort - we don't want to guess wrong
            // Just skip it
          }
          
          if (matchingPolicy && matchingPolicy.name) {
            policyName = matchingPolicy.name;
            policyNames.add(policyName);
            if (options.verbose) {
              console.warn(`Role '${role.name}': Policy ID '${policyId}' not found. Using heuristic match: '${policyName}'`);
            }
          } else {
            missingPolicies.push(policyId);
            if (options.verbose) {
              console.warn(`Role '${role.name}': Policy with ID '${policyId}' not found in policy list. Skipping.`);
            }
          }
        }
      }
      
      // Convert child role IDs to child role names for portability across environments
      const childRoleNames = [];
      const missingChildRoles = [];
      
      for (const c of role.children || []) {
        const childId = c.id || c;
        const childName = roleIdToName.get(childId);
        
        if (childName) {
          childRoleNames.push(childName);
        } else {
          missingChildRoles.push(childId);
          if (options.verbose) {
            console.warn(`Role '${role.name}': Child role with ID '${childId}' not found in role list. Skipping.`);
          }
        }
      }
      
      // Convert parent role ID to parent role name for portability across environments
      let parentRoleName = null;
      if (role.parent) {
        parentRoleName = roleIdToName.get(role.parent);
        if (!parentRoleName) {
          if (options.verbose) {
            console.warn(`Role '${role.name}': Parent role with ID '${role.parent}' not found in role list.`);
          }
          parentRoleName = null;
        }
      }
      
      const cleanRole = {
        name: role.name,
        icon: role.icon || null,
        description: role.description || null,
        parent: parentRoleName,
        children: childRoleNames.length > 0 ? childRoleNames : undefined,
        // Store policy NAMES (not IDs) that are attached to this role
        // These reference policies by name for portability across environments
        policies: policyNames.size > 0 ? Array.from(policyNames) : undefined,
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
        const publicRole = {
          name: 'Public',
          icon: 'globe',
          description: 'Öffentlicher Zugriff',
          policies: publicRolePolicyNames,
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
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportRoles;
