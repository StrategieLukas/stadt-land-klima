<template>
  <section v-if="tourVisits.length || article.profile_stage === 'preview'" class="container mx-auto px-4 pt-6">
    <div class="rounded-xl border border-solid-stats-dark-20 bg-solid-stats-dark-05 p-5 text-stats-dark shadow-sm">
      <p v-if="article.profile_stage === 'preview'" class="mb-3 text-sm font-semibold">{{ $t('tour.preview_hint') }}</p>
      <div v-for="visit in tourVisits" :key="visit.event.id" class="flex flex-wrap items-center justify-between gap-3 border-t border-solid-stats-dark-20 py-3 first:border-t-0">
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-olive-green">{{ $t('tour.on_tour') }}</p>
          <p class="font-semibold">{{ visit.series.title }} · {{ visit.event.location || visit.event.title }}</p>
          <p class="text-sm">{{ visitMessage(visit) }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <CanonicalButton :href="`/events/series/${visit.series.slug}#stop-${visit.event.slug}`" :label="$t('tour.discover')" color="dark" />
          <CanonicalButton v-if="visit.report" :href="`/news/${visit.report.slug}`" :label="$t('tour.read_report')" color="green" />
        </div>
      </div>
    </div>
  </section>
  <ArticlePage
    v-if="article.title"
    :title="article.title"
    :subtitle="article.subtitle"
    :municipality_name="article.municipality_name"
    :municipality_slug="municipalitySlug"
    :state="article.state"
    :author="article.author"
    :date="article.date_created ? new Date(article.date_created) : null"
    :image_id="article.image?.id"
    :image_is_raster="article.image ? isRaster(article.image.type) : false"
    :image_credits="article.image_credits"
    :abstract="article.abstract"
    :article_text="article.article_text"
    :link="articleLink"
    :article_instagram="article.instagram"
    :article_linkedin="article.linkedin"
    :organisation="article.organisation"
    :measures="articleMeasures"
  />
  <div v-else class="container mx-auto px-4 py-8">
    <div class="text-center">
      <div class="animate-pulse">{{ $t("generic.loading") }}</div>
    </div>
  </div>
</template>

<script setup>
  import ArticlePage from '~/components/ArticlePage.vue';
  import { isRaster } from '~/shared/utils';
  import { relationId, visitDaysAway, visitHasEnded } from '~/shared/tour';
  import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
  const { $directus, $readItems, $t } = useNuxtApp();

  const route = useRoute();
  const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

  const { data: articles } = await useAsyncData(`article-${route.params.slug}`, () => {
    return $directus.request(
      $readItems("articles", {
        fields: [
          "id", "title", "subtitle", "municipality_name", "state", "author", "date_created", "image_credits", "abstract", "article_text", "link", "instagram", "linkedin", "profile_stage",
          { image: ["id", "type"] },
          { organisation: [{ logo: ["id", "type"] }, "name", "link"] },
          { measures: [{ measures_id: ["id", "measure_id", "name", "slug"] }] }
        ],
        filter: { slug: { _eq: route.params.slug } },
        limit: 1,
      }),
    )
  });

  if (!articles.value?.length) {
    throw createError({ statusCode: 404, statusMessage: 'Projekt nicht gefunden', fatal: import.meta.client })
  }

  const article = computed(() => articles.value?.[0] || {});

  const { data: tourLinks } = await useAsyncData(`article-tour-links-${article.value.id}`, () => $directus.request(
    $readItems('events_articles', {
      filter: { articles_id: { _eq: article.value.id } },
      fields: [{ events_id: ['id', 'slug', 'title', 'location', 'start_date', 'end_date', { series: ['id', 'slug', 'title', 'format'] }] }],
      limit: -1,
    })
  ));
  const linkedEvents = computed(() => (tourLinks.value ?? []).map((link) => link.events_id).filter((event) => event?.series?.format === 'tour'));
  const { data: tourReports } = await useAsyncData(`article-tour-reports-${article.value.id}`, () => {
    const ids = linkedEvents.value.map((event) => event.id);
    return ids.length ? $directus.request($readItems('news_items', {
      filter: { report_event: { _in: ids }, status: { _eq: 'published' } },
      fields: ['slug', 'report_event'],
      limit: -1,
    })) : Promise.resolve([]);
  });
  const tourVisits = computed(() => linkedEvents.value.map((event) => ({
    event,
    series: event.series,
    report: (tourReports.value ?? []).find((report) => relationId(report.report_event) === event.id),
  })).sort((a, b) => new Date(a.event.start_date) - new Date(b.event.start_date)));
  const tourNow = useState(`project-tour-now-${route.params.slug}`, () => new Date().toISOString());
  onMounted(() => { tourNow.value = new Date().toISOString(); });
  function visitMessage(visit) {
    if (visit.report) return $t('tour.visit_report');
    if (visitHasEnded(visit.event.start_date, visit.event.end_date, new Date(tourNow.value))) return $t('tour.visit_past');
    const days = visitDaysAway(visit.event.start_date, new Date(tourNow.value));
    if (days === 0) return $t('tour.visit_today');
    if (days === 1) return $t('tour.visit_tomorrow');
    if (days !== null && days > 1) return $t('tour.visit_in_days', { ':days': days });
    return $t('tour.upcoming');
  }

  const { data: municipalityData } = await useAsyncData(
    `municipality-slug-for-article-${route.params.slug}`,
    async () => {
      if (!article.value.municipality_name) return false;
      const results = await $directus.request(
        $readItems("municipalities", {
          fields: ["slug", "ars", { scores: ["catalog_version", "published"] }],
          filter: { name: { _eq: article.value.municipality_name } },
          limit: 1,
        })
      );
      return results?.[0] ?? false;
    },
    { watch: [article] }
  );

  const municipalitySlug = computed(() => {
    const m = municipalityData.value;
    if (!m) return null;
    const publishedScore = (m.scores ?? []).find((score) => {
      const catalogVersion = typeof score.catalog_version === 'object'
        ? score.catalog_version?.id
        : score.catalog_version;
      return catalogVersion === selectedCatalogVersion.id && score.published === true;
    });
    return publishedScore ? (m.slug ?? null) : (m.ars ?? null);
  });

  const articleMeasures = computed(() => {
    return (article.value.measures || [])
      .map(m => m.measures_id)
      .filter(Boolean);
  });

  const articleLink = computed(() => {
    if (!article.value.link) return null;
    try {
      return new URL(article.value.link);
    } catch {
      console.error("Invalid URL: " + article.value.link)
      return null;
    }
  })

  //MetaTags
  const title = computed(() => article.value.title || '');
    useHead({
    title,
  });
</script>

<style scoped>
  .project-page img {
    border-radius: 0.25rem;
  }
</style>
