<template>
  <BlokkliProvider
    v-if="page"
    entity-type="pages"
    entity-bundle="page"
    :entity-uuid="page.slug"
    :can-edit="canEdit"
    :entity="page"
    class="self-center"
  >
    <template #default="{ isEditing }">
      <article class="prose py-8 self-center">
        <!-- blökkli field: renders blocks when available -->
        <BlokkliField
          name="content"
          :list="pageBlocks"
        />

        <!-- Fallback: render legacy HTML content when not editing and no blocks exist -->
        <template v-if="!isEditing && pageBlocks.length === 0 && page.contents">
          <template v-for="(block, index) in processedPageContent" :key="index">
            <div v-if="block.type === 'html'" v-html="block.html" />
            <component
              v-else-if="block.type === 'component'"
              :is="block.component"
              v-bind="block.props"
            />
          </template>
        </template>
      </article>
    </template>
  </BlokkliProvider>

  <p v-else class="prose py-8">
    {{ $t("page_not_found") }}
  </p>
</template>

<script setup>
import { readItems } from '@directus/sdk'
import OnboardingBox from "@/components/OnboardingBox.vue"
import { useAuth } from '~/composables/useAuth'
const { $directus, $readItems, $t } = useNuxtApp()
const { isAuthenticated, initialize } = useAuth()
useBlockHashNavigation()
const canEdit = ref(false)
onMounted(() => {
  initialize()
  watchEffect(() => { canEdit.value = isAuthenticated.value })
})
const route = useRoute()

// Fetch page by slug
const { data: pagesWithSlug } = await useAsyncData(`page-${route.params.slug}`, () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    })
  )
})
const page = computed(() => pagesWithSlug.value?.[0] || null)

// Load blocks from Directus — always fresh (no client-side caching)
const { data: blocksData } = await useAsyncData(
  `blocks-${route.params.slug}`,
  async () => {
    if (!page.value) return []
    try {
      const blocks = await $directus.request(
        readItems('blocks', {
          filter: {
            entity_type: { _eq: 'pages' },
            entity_uuid: { _eq: page.value.slug },
            field_name: { _eq: 'content' },
            status: { _neq: 'archived' },
          },
          sort: ['sort_order'],
        })
      )
      return (blocks || []).map(block => ({
        uuid: block.uuid,
        bundle: block.bundle,
        options: block.options || {},
        props: block.props || {},
      }))
    } catch {
      return []
    }
  },
  { watch: [page] }
)
const pageBlocks = computed(() => blocksData.value || [])

// Dynamically render component for [[[ONBOARDING_BOX]]] block
// Split content into blocks and inject Vue component(s)
const processedPageContent = computed(() => {
  if (!page.value?.contents) return []

  const parts = page.value.contents.split("[[[ONBOARDING_BOX]]]")
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
const title = computed(() => page.value ? page.value.name : $t("page_not_found"))

useHead({
  title,
})
</script>
