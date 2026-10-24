/** Security controls required by the pinned-runtime advisory review. */
export function assertReleasePolicy(base: Record<string, any>, production: Record<string, any>): void {
  const merged = { ...base.services?.directus?.environment, ...production.services?.directus?.environment };
  for (const key of ["CACHE_ENABLED", "TUS_ENABLED", "WEBSOCKETS_ENABLED", "MCP_ENABLED"]) {
    if (String(merged[key]) !== "false") throw new Error(`Pinned Directus requires ${key}=false`);
  }
  const deny = String(merged.IMPORT_IP_DENY_LIST || "").split(",");
  for (const subnet of [
    "0.0.0.0",
    "127.0.0.0/8",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "169.254.169.254",
    "::1/128",
    "fc00::/7",
    "fe80::/10",
  ]) {
    if (!deny.includes(subnet)) throw new Error(`Missing outbound deny-list control: ${subnet}`);
  }
  for (const service of ["frontend", "directus"]) {
    const ports = production.services?.[service]?.ports as unknown[] | undefined;
    if (!ports?.length || ports.some((port) => typeof port !== "string" || !port.startsWith("127.0.0.1:")))
      throw new Error(`Production ${service} must bind only to loopback`);
  }
}
