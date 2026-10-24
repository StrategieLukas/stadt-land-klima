import { directusUrl } from "./createDirectusClient.ts";
import { AccessResponseSchema, relationId, requiredId } from "./models.ts";

export default async function syncRolePolicies(
  roleId: string | null,
  roleName: string,
  policyIds: string[],
  verbose = false,
) {
  const headers = {
    Authorization: `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
    "Content-Type": "application/json",
  };
  const params = new URLSearchParams({
    limit: "-1",
    fields: "id,policy",
    [roleId === null ? "filter[role][_null]" : "filter[role][_eq]"]: roleId ?? "true",
  });
  const response = await fetch(`${directusUrl}/access?${params}`, { headers });
  if (!response.ok) throw new Error(`Reading policy attachments for ${roleName} failed: HTTP ${response.status}`);
  const existing = AccessResponseSchema.parse(await response.json()).data;
  const ids = new Set(existing.map((entry) => requiredId(relationId(entry.policy))));
  // Add first: a failed addition must not discard the previously working assignments.
  for (const policy of new Set(policyIds)) {
    if (ids.has(policy)) continue;
    const created = await fetch(`${directusUrl}/access`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: roleId, policy }),
    });
    if (!created.ok) throw new Error(`Adding policy attachment for ${roleName} failed: HTTP ${created.status}`);
  }
  for (const entry of existing) {
    if (policyIds.includes(requiredId(relationId(entry.policy)))) continue;
    const removed = await fetch(`${directusUrl}/access/${encodeURIComponent(requiredId(entry.id))}`, {
      method: "DELETE",
      headers,
    });
    if (!removed.ok) throw new Error(`Removing policy attachment for ${roleName} failed: HTTP ${removed.status}`);
  }
  if (verbose) console.info(`Policy attachments synchronized for role ${roleName}`);
}
