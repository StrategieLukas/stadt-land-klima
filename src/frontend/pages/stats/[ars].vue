<template>
  <div />
</template>

<script setup lang="ts">
import { areaToSlug } from '~/composables/useAreaBySlug.js'

const route = useRoute()
const ars = String(route.params.ars ?? '')
const area = await $fetch<{ prefix?: string; name?: string }>('/api/area-by-slug', {
  params: { slug: ars },
}).catch(() => null)

if (!area?.name) {
  throw createError({ statusCode: 404, statusMessage: 'Area not found' })
}

await navigateTo(`/data/${areaToSlug(area.prefix ?? '', area.name)}`, {
  redirectCode: 301,
  replace: true,
})
</script>
