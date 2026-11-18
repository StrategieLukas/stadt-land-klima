/** Allow contact/application destinations without exposing executable URL schemes. */
export function resolveJobApplicationLink(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;

  try {
    if (input.startsWith("/") && !input.startsWith("//")) {
      const base = "https://job-link.invalid";
      const url = new URL(input, base);
      if (url.origin !== base || url.pathname.startsWith("//")) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    }

    const url = new URL(input);
    if (url.username || url.password) return null;
    if (url.protocol === "mailto:" && url.pathname) return url.href;
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return null;
  }
  return null;
}
