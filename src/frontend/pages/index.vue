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
        <article class="px-4 pb-8 max-w-4xl mx-auto w-full self-center">
          <!-- blökkli field: renders blocks when available -->
          <BlokkliField
            name="content"
            :list="pageBlocks"
          />

          <!-- Fallback: render legacy HTML when no blocks and not editing -->
          <div
            v-if="!isEditing && pageBlocks.length === 0 && page.contents"
            class="prose"
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
import { useAuth } from '~/composables/useAuth'
import { fetchDirectusBlocks } from '~/composables/useDirectusBlocks'
const { $directus, $readItems, $t } = useNuxtApp();
const { isAuthenticated, initialize } = useAuth();
useBlockHashNavigation()
const canEdit = ref(false)
onMounted(() => {
  initialize()
  watchEffect(() => { canEdit.value = isAuthenticated.value })
})

const { data: indexPages } = await useAsyncData("indexPages", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: "index" } },
      limit: 1,
    }),
  );
});
const page = computed(() => indexPages.value?.[0] || null);

// Load blocks from Directus — always fresh (no client-side caching)
const { data: blocksData } = await useAsyncData(
  'blocks-index',
  async () => {
    return fetchDirectusBlocks({
      directus: $directus,
      entityType: 'pages',
      entityUuid: page.value?.slug,
    })
  },
  { watch: [page] }
)
const pageBlocks = computed(() => blocksData.value || [])

//MetaTags
const title = computed(() => page.value ? page.value.name : $t("page_not_found"));

//MetaTags
useHead({
  title,
}); //
</script>
