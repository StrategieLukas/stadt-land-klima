<template>
  <div
    class="blokkli-block-directus-page prose max-w-none"
    v-html="props.content || ''"
  />
</template>

<script setup lang="ts">
defineBlokkli({
  bundle: 'directus_page',
  editor: {
    addBehaviour: 'no-form',
    mockProps: (text) => {
      return {
        content: text || '<p>Seiteninhalt wird hier eingefügt...</p>',
      }
    },
  },
})

const props = defineProps<{
  content?: string
}>()
</script>
