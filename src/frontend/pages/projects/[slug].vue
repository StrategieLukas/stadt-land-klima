<template>
  <ArticlePage
    v-if="article.title"
    :title="article.title"
    :subtitle="article.subtitle"
    :municipality_name="article.municipality_name"
    :state="article.state"
    :author="article.author"
    :date="article.date_created ? new Date(article.date_created) : null"
    :image_id="article.image.id"
    :image_is_raster="isRaster(article.image.type)"
    :image_credits="article.image_credits"
    :abstract="article.abstract"
    :article_text="article.article_text"
    :link="articleLink"
    :article_instagram="article.instagram"
    :article_linkedin="article.linkedin"
    :organisation="article.organisation"
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
  const { $directus, $readItems } = useNuxtApp();

  const route = useRoute();

  const { data: articles } = await useAsyncData(`article-${route.params.slug}`, () => {
    return $directus.request(
      $readItems("articles", {
        fields: [
          "title", "subtitle", "municipality_name", "state", "author", "date_created", "image_credits", "abstract", "article_text", "link", "instagram", "linkedin",
          { image: ["id", "type"] },
          { organisation: ["name", "logo", "link"] }
        ],
        filter: { slug: { _eq: route.params.slug } },
        limit: 1,
      }),
    )
  });


  const article = computed(() => articles.value?.[0] || {});

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
