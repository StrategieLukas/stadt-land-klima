<template>
  <div class="blokkli-block-directus-page prose max-w-none">
    <div v-if="pageHtml" v-html="pageHtml" />
    <p v-else class="text-gray italic">Kein Seiteninhalt verfügbar.</p>
  </div>
</template>

<script setup lang="ts">
import { readItems } from '@directus/sdk'

defineBlokkli({
  bundle: 'directus_page',
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Directus Seite',
    mockProps: () => {
      return {
        pageSlug: 'index',
      }
    },
  },
})

const props = defineProps<{
  pageSlug?: string
}>()

const { $directus } = useNuxtApp()

// Use useAsyncData so content is fetched during SSR and included in the Nuxt payload,
// preventing any loading flash on page refresh.
const { data: pageHtml } = await useAsyncData<string>(
  `directus-page-${props.pageSlug ?? ''}`,
  async () => {
    if (!props.pageSlug) return ''
    try {
      const pages = await $directus.request(
        readItems('pages' as any, {
          filter: { slug: { _eq: props.pageSlug } },
          fields: ['contents'],
          limit: 1,
        }),
      )
      return (pages as any)?.[0]?.contents || ''
    } catch {
      return ''
    }
  },
  { watch: [() => props.pageSlug] }
)
</script>
