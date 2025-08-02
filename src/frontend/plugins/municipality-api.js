export default defineNuxtPlugin(() => {
  const getMunicipalityLocations = async (slugs = []) => {
    if (!Array.isArray(slugs) || slugs.length === 0) return []

    // EXAMPLE MOCK CODE for testing only
    const a = slugs
      .map(slug => slug, { lower: true, strict: true })
      .filter(Boolean)
      .map(slug => ({
        slug,
        // Generate lat/lng roughly within Germany bounds
        lat: 47.0 + Math.random() * 6.5,  // 47 to 53.5
        lng: 5.9 + Math.random() * 9.5,   // 5.9 to 15.4
      }))

      console.log(a);
      return a;

    // Call real API
    return await $fetch(`zahlen.stadt-land-klima.de/api/municipalities/${slugs.join(',')}/?fields=slug,lat,lon`)
  }

  return {
    provide: {
      municipalityApi: {
        getMunicipalityLocations,
      },
    },
  }
})
