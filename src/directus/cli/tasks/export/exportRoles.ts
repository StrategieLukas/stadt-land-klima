import { readPolicies, readRoles } from "@directus/sdk";
import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";
import { stringify } from "yaml";
import createDirectusClient, { directusUrl } from "../shared/createDirectusClient.ts";
import type { TaskOptions } from "../shared/models.ts";
import { AccessResponseSchema, relationId } from "../shared/models.ts";

export default async function exportRoles(dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient();
  const policies = await client.request(readPolicies({ limit: -1 }));
  const roles = await client.request(readRoles({ limit: -1 }));
  const policyNames = new Map(policies.map((policy) => [policy.id, policy.name]));
  const roleNames = new Map(roles.map((role) => [role.id, role.name]));
  const params = new URLSearchParams({ limit: "-1", fields: "role,policy" });
  const response = await fetch(`${directusUrl}/access?${params}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
    },
  });
  if (!response.ok) throw new Error(`Reading role policy attachments failed: HTTP ${response.status}`);
  const access = AccessResponseSchema.parse(await response.json()).data;
  // Access entries are authoritative. Similar role/policy names are never proof of an assignment.
  function attachedPolicies(roleId: string | null): string[] {
    const result = new Set<string>();
    for (const entry of access) {
      if (relationId(entry.role) !== roleId) continue;
      const name = policyNames.get(relationId(entry.policy) ?? "");
      if (!name) throw new Error("A role references a policy that was not returned by Directus");
      result.add(name);
    }
    return [...result].sort();
  }
  fs.mkdirSync(dest, { recursive: true });
  function write(name: string, value: object) {
    const label = name === "$t:public_label" || name === "Public" ? "public" : name.replace(/^\$t:/, "");
    const file = path.join(dest, `${slugify(label, { replacement: "_", lower: false })}.yaml`);
    if (!options.overwrite && fs.existsSync(file)) return;
    fs.writeFileSync(file, stringify(value), "utf8");
    if (options.verbose) console.info(`Exported role ${file}`);
  }
  for (const role of roles) {
    if (role.name === "Administrator") continue;
    const parentId = relationId(role.parent);
    const parent = parentId ? roleNames.get(parentId) : undefined;
    if (parentId && !parent) throw new Error(`Unknown parent role for ${role.name}`);
    const children = roles
      .filter((child) => relationId(child.parent) === role.id)
      .map((child) => child.name)
      .sort();
    const attached = attachedPolicies(role.id);
    const output: Record<string, unknown> = { name: role.name };
    if (role.icon) output.icon = role.icon;
    if (role.description) output.description = role.description;
    if (parent) output.parent = parent;
    if (children.length) output.children = children;
    if (attached.length) output.policies = attached;
    write(role.name, output);
  }
  const publicPolicies = attachedPolicies(null);
  if (publicPolicies.length)
    write("Public", {
      name: "Public",
      icon: "globe",
      description: "Öffentlicher Zugriff",
      policies: publicPolicies,
    });
}
