<template>
  <div class="w-full">
    <BlokkliPageProvider
      v-if="page"
      entity-type="pages"
      entity-bundle="page"
      :entity-uuid="page.id"
      :can-edit="canEdit"
      :entity="page"
    >
      <template #default="{ isEditing }">
        <article class="mx-auto w-full max-w-4xl self-center px-4 pb-8">
          <!-- blökkli field: renders blocks when available -->
          <BlokkliField name="content" :list="pageBlocks" />

          <!-- Fallback: render legacy HTML when no blocks and not editing -->
          <div
            v-if="!isEditing && pageBlocks.length === 0 && page.contents"
            class="prose"
            v-html="sanitizeHtml(sanitizedContents)"
          />
        </article>
      </template>
    </BlokkliPageProvider>
    <p v-else class="mx-auto prose w-full max-w-4xl self-center px-4 py-8">
      {{ $t("page_not_found") }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { clientFailure } from "~/shared/securityLog";

import { useAuth } from "~/composables/useAuth";
import { getBlokkliDataKey, mapBlokkliBlocks } from "~/shared/blokkliPersistence";
import { sanitizeHtml } from "~/utils/sanitizeHtml";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();
const { isAuthenticated, initialize } = useAuth();
useBlockHashNavigation();
const canEdit = ref(false);
onMounted(() => {
  void initialize();
  watchEffect(() => {
    canEdit.value = isAuthenticated.value;
  });
});

const { data: indexPageResult } = await useAsyncData("indexPage", () => {
  return fetchContent("/api/public/pages/index");
});
const page = computed(() => indexPageResult.value?.page || null);

const blocksKey = getBlokkliDataKey("pages", String(page.value?.id || "missing"));

// Load blocks by the immutable page ID. Slugs are routing labels and may change.
const { data: blocksData } = await useAsyncData(
  blocksKey,
  async () => {
    if (!page.value) return [];
    try {
      const result = await fetchContent("/api/public/blocks", {
        query: { entityUuid: page.value.id, bundle: "page" },
      });
      return mapBlokkliBlocks(result.blocks || []);
    } catch (error) {
      clientFailure("app.pages.index.failed", error);
      throw error;
    }
  },
  { watch: [page] },
);
const pageBlocks = computed(() => blocksData.value || []);
const sanitizedContents = computed(() => sanitizeHtml(page.value?.contents));

//MetaTags
const seoText = useSeoText();
const title = computed(() => seoText("seo.title"));

//MetaTags
usePageSeo({
  title,
}); //
</script>
