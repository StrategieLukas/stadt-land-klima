<template>
  <div :id="'block-' + uuid" class="blokkli-block-directus-page prose max-w-none">
    <div v-if="pageHtml" v-html="sanitizeHtml(pageHtml)" />
    <p v-else class="text-gray italic">Kein Seiteninhalt verfügbar.</p>
  </div>
</template>

<script setup lang="ts">
import { sanitizeHtml } from "~/utils/sanitizeHtml";
const fetchContent = useContentFetch();

const { uuid } = defineBlokkli({
  bundle: "directus_page",
  editor: {
    addBehaviour: "no-form",
    editTitle: () => "Directus Seite",
    mockProps: () => {
      return {
        pageSlug: "index",
      };
    },
  },
});

const props = defineProps<{
  pageSlug?: string | undefined;
}>();

// Use useAsyncData so content is fetched during SSR and included in the Nuxt payload,
// preventing any loading flash on page refresh.
const { data: pageHtml } = await useAsyncData<string>(
  `directus-page-${props.pageSlug ?? ""}`,
  async () => {
    if (!props.pageSlug) return "";
    try {
      const result = await fetchContent(`/api/public/pages/${encodeURIComponent(props.pageSlug)}`);
      return sanitizeHtml(result.page.contents || "");
    } catch {
      return "";
    }
  },
  { watch: [() => props.pageSlug] },
);
</script>
