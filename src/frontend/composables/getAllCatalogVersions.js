// Returns all available catalog versions (not hidden)
export async function getAllCatalogVersions() {
  return await $fetch('/api/public/catalogs');
}
