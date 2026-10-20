<template>
  <section v-if="tourVisits.length || article.profile_stage === 'preview'" class="container mx-auto px-4 pt-6">
    <div class="project-tour-banner p-5">
      <p v-if="article.profile_stage === 'preview'" class="project-tour-banner__notice text-sm">{{ $t('tour.preview_hint') }}</p>
      <div v-for="visit in tourVisits" :key="visit.stop.id" class="project-tour-banner__visit" :class="{ 'project-tour-banner__visit--with-image': visit.tour.cover_image }">
        <div class="project-tour-banner__copy">
          <p class="font-heading text-xl font-bold">{{ visit.tour.title }} · {{ visit.stop.location || visit.stop.title }}</p>
          <p class="text-sm">{{ visitMessage(visit) }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <CanonicalButton :href="`/projects/tours/${visit.tour.slug}#stop-${visit.stop.slug}`" :label="$t('tour.discover')" icon-slug="mdi:map-marker-path" color="dark" />
            <CanonicalButton v-if="visit.report" :href="`/projects/tours/${visit.tour.slug}/${visit.stop.slug}`" :label="$t('tour.stop_details')" icon-slug="mdi:arrow-right" color="bright-green" />
          </div>
        </div>
        <figure v-if="visit.tour.cover_image" class="project-tour-banner__media">
          <NuxtLink :to="`/projects/tours/${visit.tour.slug}#stop-${visit.stop.slug}`" class="block">
            <SmartImg :asset-id="relationId(visit.tour.cover_image)" :is-raster="isRaster(visit.tour.cover_image.type || 'image/jpeg')" :alt="visit.tour.title" :width="520" fit="contain" img-class="block max-h-40 w-full object-contain" />
          </NuxtLink>
          <figcaption v-if="visit.tour.cover_image_credits" class="mt-2 text-xs">{{ visit.tour.cover_image_credits }}</figcaption>
        </figure>
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
  import { isMunicipalityScoreComplete } from '~/shared/municipality-score-publishing.js';
  const { $t } = useNuxtApp();

  const route = useRoute();
  const slug = String(route.params.slug);

  // Use server routes — $directus is only available during SSR, not on client
  const { data: articleResult } = await useAsyncData(`article-detail-${slug}`, async () =>
    $fetch(`/api/public/articles/${slug}`)
  );
  const article = computed(() => articleResult.value?.article || {});

  if (!article.value.id) {
    throw createError({ statusCode: 404, statusMessage: $t('page_not_found'), fatal: true })
  }

  // Tour visits for this article
  const { data: tourVisitsResult } = await useAsyncData(`article-tour-visits-${article.value.id}`, async () =>
    $fetch('/api/public/article-tour-visits', { query: { articleId: article.value.id } })
  );
  const tourVisits = computed(() => tourVisitsResult.value?.visits ?? []);

  const tourNow = useState(`project-tour-now-${slug}`, () => new Date().toISOString());
  onMounted(() => { tourNow.value = new Date().toISOString(); });
  function visitMessage(visit) {
    if (visit.report) return $t('tour.visit_report');
    if (visitHasEnded(visit.stop.start_date, visit.stop.end_date, new Date(tourNow.value))) return $t('tour.visit_past');
    const days = visitDaysAway(visit.stop.start_date, new Date(tourNow.value));
    if (days === 0) return $t('tour.visit_today');
    if (days === 1) return $t('tour.visit_tomorrow');
    if (days !== null && days > 1) return $t('tour.visit_in_days', { ':days': days });
    return $t('tour.upcoming');
  }

  // Municipality slug for the article
  const { data: municipalityResult } = await useAsyncData(
    `municipality-by-name-${article.value.municipality_name}`,
    async () => {
      if (!article.value.municipality_name) return { municipality: null };
      return $fetch('/api/public/municipality-by-name', { query: { name: article.value.municipality_name } });
    },
    { watch: [article] }
  );

  // Get catalog version for municipality slug resolution
  const selectedCatalogVersion = await getCatalogVersion(route);
  const municipalitySlug = computed(() => {
    const m = municipalityResult.value?.municipality;
    if (!m) return null;
    const publishedScore = (m.scores ?? []).find((score) => {
      const catalogVersion = typeof score.catalog_version === 'object'
        ? score.catalog_version?.id
        : score.catalog_version;
      return catalogVersion === selectedCatalogVersion.id && isMunicipalityScoreComplete(score);
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
  .project-tour-banner {
    --banner-border: #b9b9b9;
    --banner-shadow: #505050;
    border: 3px solid var(--banner-border);
    border-radius: 0;
    background: var(--slk-surface, #fff);
    color: var(--slk-text, #505050);
    box-shadow: 3px 3px 0 var(--banner-shadow);
  }
  .project-tour-banner__notice { margin-bottom: 1rem; color: var(--slk-text-muted, #707070); }
  .project-tour-banner__visit { display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: 1.25rem; padding: 1rem 0; border-top: 1px solid var(--banner-border); }
  .project-tour-banner__visit:first-child { border-top: 0; }
  .project-tour-banner__visit:last-child { padding-bottom: 0; }
  .project-tour-banner__copy { display: grid; gap: .5rem; min-width: 0; }
  .project-tour-banner__media { width: 100%; max-width: 22rem; }
  @media (min-width: 768px) {
    .project-tour-banner__visit--with-image { grid-template-columns: minmax(0, 1fr) minmax(15rem, 28%); gap: 2rem; }
    .project-tour-banner__media { justify-self: end; }
  }
  .project-page img {
    border-radius: 0.25rem;
  }
</style>
