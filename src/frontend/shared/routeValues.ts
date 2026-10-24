/** Vue Router values can be absent, repeated or null. Never stringify those cases. */
export function singleRouteValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function routeSlug(value: unknown): string | undefined {
  const text = singleRouteValue(value);
  return text && /^[a-z0-9-]{1,160}$/.test(text) ? text : undefined;
}

export function routeText(value: unknown, maximum: number): string {
  const text = singleRouteValue(value);
  return text && text.length <= maximum ? text : "";
}
