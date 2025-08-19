// This file exists to include complex calls to directus that are used frequently, i.e. sending several requests to several collections
// and then combining the data to create complex objects.

export async function fetchArticlesWithOrganisations($directus, $readItems) {

  try {
    const articles = await $directus.request(
      $readItems("articles", {
        fields: [
          "slug",
          "title",
          "image",
          "abstract",
          "author",
          "date_created",
          "municipality_name",
          "state",
          "organisation"
        ],
        sort: "-date_created",
        limit: -1,
      })
    );

    // Null-safe Organisation-IDs extrahieren
    const orgIds = [...new Set(
      articles
        .map(article => {
          const org = article.organisation;
          if (org == null) return null;
          return typeof org === 'object' ? org.key : org;
        })
        .filter(id => id != null)
    )];

    let organisations = [];
    if (orgIds.length > 0) {
      organisations = await $directus.request(
        $readItems("organisations", {
          fields: ["id", "name", "logo", "link"],
          filter: { id: { _in: orgIds } }
        })
      );
    }

    const orgMap = new Map(organisations.map(org => [org.id, org]));

    const articlesWithOrganisations = articles.map(article => {
      const orgRaw = article.organisation;
      if (orgRaw == null) return { ...article, organisation: null };
      const orgId = typeof orgRaw === 'object' ? orgRaw.key : orgRaw;
      return {
        ...article,
        organisation: orgMap.get(orgId) || null
      };
    });

    return articlesWithOrganisations;

  } catch (err) {
    console.error("❌ Failed to fetch articles:", err);
    return [];
  }
}
