import path from "path";
import type { TaskOptions } from "../shared/models.ts";
import importPolicies from "./importPolicies.ts";
import importRoles from "./importRoles.ts";

/**
 * Import roles and policies for Directus v11+.
 *
 * Source directory structure:
 * - {src}/policies/  - policy YAML files
 * - {src}/roles/     - role YAML files
 */
async function importRolesAndPolicies(src: string, options: TaskOptions = {}) {
  try {
    if (options.verbose) console.info("Importing policies...");
    await importPolicies(path.join(src, "policies"), options);

    if (options.verbose) console.info("Importing roles...");
    await importRoles(path.join(src, "roles"), options);

    if (options.verbose) console.info("Roles and policies imported");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importRolesAndPolicies;
