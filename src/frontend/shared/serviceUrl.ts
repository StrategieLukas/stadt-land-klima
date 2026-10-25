/** Validate configuration without reflecting URL credentials in errors or logs. */
export function serviceBaseUrl(input: unknown, fallback: string): string {
  const value = input === undefined || input === null || input === "" ? fallback : input;
  if (typeof value !== "string") throw new Error("Invalid service URL");
  const relative = value.startsWith("/") && !value.startsWith("//");
  let url: URL;
  try {
    url = new URL(value, relative ? "http://nuxt.internal" : undefined);
  } catch {
    throw new Error("Invalid service URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Invalid service URL");
  return (relative ? url.pathname : url.toString()).replace(/\/+$/, "");
}
