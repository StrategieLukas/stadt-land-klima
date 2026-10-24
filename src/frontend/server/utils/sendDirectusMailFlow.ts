/** Resolve legacy/public webhook URLs through the private Directus API. */
export async function sendDirectusMailFlow(
  flowUrl: string,
  directusUrl: string,
  adminToken: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const base = new URL(directusUrl);
  const target = new URL(flowUrl);
  const prefix = base.pathname.replace(/\/+$/, "");
  const trigger = target.pathname.match(
    /\/flows\/trigger\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
  );

  if (
    !adminToken ||
    !["http:", "https:"].includes(base.protocol) ||
    !["http:", "https:"].includes(target.protocol) ||
    !trigger ||
    target.username ||
    target.password ||
    target.search ||
    target.hash
  ) {
    throw new Error("Mail flow must use a valid Directus trigger URL without URL credentials or query parameters.");
  }

  // Only reuse the ID. Public proxy aliases must never receive the service token.
  const endpoint = new URL(`${prefix}/flows/trigger/${trigger[1]}`, base.origin);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    // A redirect must never forward this credential or replay a mail operation.
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Directus mail flow failed with HTTP ${response.status}.`);
  }
}
