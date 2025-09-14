<template>
  <article v-if="page" class="prose py-8 self-center">
    <template v-for="(block, index) in processedPageContent" :key="index">
      <!-- Render plain HTML parts -->
      <div v-if="block.type === 'html'" v-html="block.html" />

      <!-- Render the component when placeholder is found -->
      <component
        v-else-if="block.type === 'component'"
        :is="block.component"
        v-bind="block.props"
      />
    </template>
  </article>

  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>

<script setup>
import OnboardingBox from "@/components/OnboardingBox.vue"
import { watch } from "vue";

const { $directus, $readItems } = useNuxtApp();
const { locale, t } = useI18n();
const route = useRoute();

const fetchSlugPage = async () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: route.params.slug } },
      fields: ["*", "translations.*"],
      deep: {
        translations: {
          _filter: {
            languages_code: { _eq: locale.value },
          },
        },
      },
      limit: 1,
    }),
  );
};

const { data: pagesWithSlug } = await useAsyncData("pagesWithSlug", fetchSlugPage);

watch(
  locale,
  async () => {
    pagesWithSlug.value = await fetchSlugPage();
  },
  { immediate: false },
);

const page = pagesWithSlug.value[0] || null;

// Dynamically render component for [[[ONBOARDING_BOX]]] block
// Split content into blocks and inject Vue component(s)
const processedPageContent = computed(() => {
  if (!page?.translations[0].contents) return []

  const parts = page.translations[0].contents.split("[[[ONBOARDING_BOX]]]")
  const blocks = []

  parts.forEach((html, idx) => {
    if (html) blocks.push({ type: "html", html })
    if (idx < parts.length - 1) {
      blocks.push({
        type: "component",
        component: OnboardingBox,
        props: {
          name: "Otto",
          "avatar-src":
            "https://stadt-land-klima.de/backend/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96",
        },
      })
    }
  })

  return blocks
})

// MetaTags
const title = page ? ref(page.translations[0].name) : t("page_not_found");

useHead({
  title,
})
</script>
