<template>
  <div
    class="data-products-coming-soon flex flex-wrap items-center justify-between gap-3 rounded-lg border"
    :class="compact ? 'p-3' : 'p-5'"
  >
    <div class="min-w-0 flex-1 basis-32">
      <h3 class="font-heading font-bold" :class="compact ? 'text-base' : 'text-xl'">
        {{ $t("data.products.coming_soon") }}
      </h3>
      <p class="mt-1 leading-relaxed" :class="compact ? 'text-xs' : 'text-sm'">
        {{ $t("data.products.feedback_invite") }}
      </p>
    </div>
    <CanonicalButton
      :href="contactHref"
      :label="$t('data.products.contact')"
      icon-slug="mdi:email-outline"
      color="dark"
      class="shrink-0 self-center"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  collectionCount: number;
  areaName?: string | undefined;
  compact?: boolean | undefined;
}>();

const { $t } = useNuxtApp();
const route = useRoute();

const contactHref = computed(() => {
  const title = props.areaName
    ? $t("data.products.contact_title", { ":area": props.areaName })
    : $t("data.products.contact_title_general");
  const content = props.areaName
    ? $t("data.products.contact_content", { ":area": props.areaName, ":url": route.path })
    : $t("data.products.contact_content_general", { ":url": route.path });
  const params = new URLSearchParams({ title, type: "suggestion", content });
  return `/contact?${params.toString()}`;
});
</script>

<style scoped>
.data-products-coming-soon {
  grid-column: span var(--data-products-fill, 2);
  min-width: 0;
  background-color: var(--slk-blue-tint, #e6f1f5);
  border-color: var(--slk-border, #d9dfd3);
  color: var(--slk-text, #505050);
}

.data-products-coming-soon h3 {
  color: var(--slk-blue, #006e94);
}
</style>
