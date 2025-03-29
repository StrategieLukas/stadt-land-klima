<template>
  <ArticlePage
    :title="article.title"
    :subtitle="article.subtitle"
    :municipality_name="article.municipality_name"
    :state="article.state"
    :author="article.author"
    :date="new Date(article.date_created)"
    :image="article.image"
    :image_credits="article.image_credits"
    :abstract="article.abstract"
    :article_text="article.article_text"
    :link="article.link"
    :organisation="organisation"
  />
</template>

<script setup>
  import ArticlePage from '~/components/ArticlePage.vue';
  const { $directus, $readItems } = useNuxtApp();

  const route = useRoute();

  const { data: articles } = await useAsyncData("articles", () => {
    return $directus.request(
      $readItems("articles", {
        fields: ["title", "subtitle", "municipality_name", "state", "author", "date_created", "image", "image_credits", "abstract", "article_text", "link", "organisation"],
        filter: { slug: { _eq: route.params.slug } },
        limit: 1,
      }),
    )
  });

  const article = articles.value[0];
 
  //MetaTags
  const title = ref(article.title);
    useHead({
    title,
  });

  const { data: organisation } = await useAsyncData("organisation", async () => {
  if (!article.organisation) return null;

  const result = await $directus.request(
    $readItems("organisations", {
      fields: ["id", "name", "logo", "link"],
      filter: { id: { _eq: article.organisation.key } },
    })
  );

  return result?.[0] || null; // Return the first organisation or null if empty
});


</script>
  
<style scoped>
  .project-page img {
    border-radius: 0.25rem;
  }
</style>
