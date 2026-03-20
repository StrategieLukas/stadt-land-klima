<template>
  <div class="w-full">
    <BlokkliProvider
      v-if="page"
      entity-type="pages"
      entity-bundle="page"
      :entity-uuid="page.slug"
      :can-edit="canEdit"
      :entity="page"
    >
      <template #default="{ isEditing }">
        <article class="prose px-4 py-8 max-w-4xl mx-auto w-full self-center">
          <!-- blökkli field: renders blocks when available -->
          <BlokkliField
            name="content"
            :list="pageBlocks"
          />

          <!-- Fallback: render legacy HTML when no blocks and not editing -->
          <div
            v-if="!isEditing && pageBlocks.length === 0 && page.contents"
            v-html="page.contents"
          />
        </article>
      </template>
    </BlokkliProvider>
    <p v-else class="prose px-4 py-8 max-w-4xl mx-auto w-full self-center">
      {{ $t("page_not_found") }}
    </p>
  </div>
</template>
<script setup>
import { readItems } from '@directus/sdk'
import { useAuth } from '~/composables/useAuth'
const { $directus, $readItems, $t } = useNuxtApp();
const { isAuthenticated, initialize } = useAuth();
if (process.client) { initialize(); }
const canEdit = isAuthenticated;

const { data: indexPages } = await useAsyncData("indexPages", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: "index" } },
      limit: 1,
    }),
  );
});
const page = indexPages.value[0] || null;

// Load blocks for this page from Directus
const pageBlocks = ref([])

if (page) {
  try {
    const blocks = await $directus.request(
      readItems('blocks', {
        filter: {
          entity_type: { _eq: 'pages' },
          entity_uuid: { _eq: page.slug },
          field_name: { _eq: 'content' },
          status: { _neq: 'archived' },
        },
        sort: ['sort_order'],
      })
    )
    pageBlocks.value = (blocks || []).map(block => ({
      uuid: block.uuid,
      bundle: block.bundle,
      options: block.options || {},
      props: block.props || {},
    }))
  } catch {
    // blocks collection may not exist yet
    pageBlocks.value = []
  }
}

//MetaTags
const title = page ? ref(page.name) : $t("page_not_found");

//MetaTags
useHead({
  title,
}); //
</script>
