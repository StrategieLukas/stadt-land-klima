import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { Catalog } from "~/shared/contracts/search";
type CatalogRoute = Pick<RouteLocationNormalizedLoaded, "query">;
const fetchCatalogs = getAllCatalogVersions;

export async function getCatalogVersion(route: CatalogRoute, showCurrentBackend = false) {
  const versions = await fetchCatalogs();

  if (!versions.length) throw new Error("No catalog versions available");

  const param = route.query.v;
  if (param !== undefined && (typeof param !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(param))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid catalog" });
  }
  const matched = versions.find((v) => v.name === param);
  if (matched) return matched;

  // If a preview token is present, always use the current backend version.
  // Otherwise respect the showCurrentBackend flag (defaults to isCurrentFrontend).
  const useBackend = showCurrentBackend || (typeof route.query.preview === "string" && !!route.query.preview);
  const defaults = versions.filter((v) => (useBackend ? v.isCurrentBackend === true : v.isCurrentFrontend === true));
  if (defaults.length !== 1) {
    throw new Error(
      `Exactly one version with ${useBackend ? "isCurrentBackend" : "isCurrentFrontend"}===true is required.`,
    );
  }

  return defaults[0]!;
}

export async function getCurrentFrontendCatalogVersion() {
  const versions = await fetchCatalogs();
  return versions.find((v) => v.isCurrentFrontend === true);
}

export async function getCurrentBackendCatalogVersion() {
  const versions = await fetchCatalogs();
  const matched = versions.filter((v) => v.isCurrentBackend === true);
  if (matched.length !== 1) {
    throw new Error("Exactly one visible catalog version with isCurrentBackend===true is required.");
  }
  return matched[0]!;
}

// Fetches the catalog version and updates the URL to match it
export async function setCatalogVersionUrl(route: CatalogRoute, router: Router, selectedCatalogVersion: Catalog) {
  // Change the URL to match the catalog version, if it didn't to begin with
  if (import.meta.client && route.query.v != selectedCatalogVersion.name) {
    await router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  }
}
