<template>
  <BlokkliPageProvider
    v-if="page"
    entity-type="pages"
    entity-bundle="page"
    :entity-uuid="page.id"
    :can-edit="canEdit"
    :entity="page"
    class="self-center"
  >
    <template #default="{ isEditing }">
      <article class="prose self-center pb-8">
        <!-- blökkli field: renders blocks when available -->
        <BlokkliField name="content" :list="pageBlocks" />

        <!-- Fallback: render legacy HTML content when not editing and no blocks exist -->
        <template v-if="!isEditing && pageBlocks.length === 0 && page.contents">
          <template v-for="(block, index) in processedPageContent" :key="index">
            <div v-if="block.type === 'html'" v-html="sanitizeHtml(block.html)" />
            <OnboardingBox v-else-if="block.type === 'component'" name="Otto" :avatar-src="onboardingAvatarUrl" />
          </template>
        </template>
      </article>
    </template>
  </BlokkliPageProvider>

  <p v-else class="prose py-8">
    {{ $t("page_not_found") }}
  </p>
</template>

<script setup lang="ts">
import OnboardingBox from "@/components/OnboardingBox.vue";
import { useAuth } from "~/composables/useAuth";
import { getBlokkliDataKey, mapBlokkliBlocks } from "~/shared/blokkliPersistence";
import { routeSlug } from "~/shared/routeValues";
import { sanitizeHtml } from "~/utils/sanitizeHtml";
const { $t } = useNuxtApp();
const config = useRuntimeConfig();
const { isAuthenticated, initialize } = useAuth();
useBlockHashNavigation();
const canEdit = ref(false);
onMounted(() => {
  void initialize();
  watchEffect(() => {
    canEdit.value = isAuthenticated.value;
  });
});
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Page not found" });

// Fetch page by slug
const { data: pageResult } = await useAsyncData(`page-${slug}`, () => {
  return $fetch(`/api/public/pages/${encodeURIComponent(slug)}`);
});
const page = computed(() => pageResult.value?.page || null);

// Throw a real 404 so error.vue is rendered instead of the layout fallback
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Page not found", fatal: import.meta.client });
}

const blocksKey = getBlokkliDataKey("pages", String(page.value?.id || "missing"));

// Load blocks by the immutable page ID. Slugs are routing labels and may change.
const { data: blocksData } = await useAsyncData(
  blocksKey,
  async () => {
    if (!page.value) return [];
    try {
      const result = await $fetch("/api/public/blocks", {
        query: { entityUuid: page.value.id, entityType: "pages", fieldName: "content" },
      });
      return mapBlokkliBlocks(result.blocks || []);
    } catch (error) {
      console.error("[blokkli] Failed to load page blocks:", error);
      throw error;
    }
  },
  { watch: [page] },
);
const pageBlocks = computed(() => blocksData.value || []);
const onboardingAvatarUrl = computed(() => {
  const directusUrl = config.public.clientDirectusUrl || "http://127.0.0.1:8081";
  return `${directusUrl.replace(/\/+$/, "")}/assets/56a814bb-fac4-4b80-88d7-a6fc8bd71580?width=96&height=96`;
});

// Dynamically render component for [[[ONBOARDING_BOX]]] block
// Split content into blocks and inject Vue component(s)
const processedPageContent = computed(() => {
  if (!page.value?.contents) return [];

  const parts = page.value.contents.split("[[[ONBOARDING_BOX]]]");
  const blocks: ({ type: "html"; html: string } | { type: "component" })[] = [];

  parts.forEach((html, idx) => {
    if (html) blocks.push({ type: "html", html: sanitizeHtml(html) });
    if (idx < parts.length - 1) {
      blocks.push({
        type: "component",
      });
    }
  });

  return blocks;
});

// MetaTags
const title = computed(() => (page.value ? page.value.name : $t("page_not_found")));

useHead({
  title,
});
</script>
