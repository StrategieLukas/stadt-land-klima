<template>
  <div
    class="data-products-coming-soon flex min-h-[180px] flex-col justify-center gap-4 rounded-lg border p-5"
    :class="tileLayout"
  >
    <div>
      <h3 class="font-heading text-xl font-bold">{{ $t("data.products.coming_soon") }}</h3>
      <p class="mt-1 text-sm leading-relaxed">{{ $t("data.products.feedback_invite") }}</p>
    </div>
    <CanonicalButton
      :href="contactHref"
      :label="$t('data.products.contact')"
      icon-slug="mdi:email-outline"
      color="dark"
      class="self-start"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  collectionCount: number;
  areaName?: string | undefined;
}>();

const { $t } = useNuxtApp();
const route = useRoute();

const tileLayout = computed(() => ({
  "xs:col-span-2 xs:min-h-[160px]": props.collectionCount % 2 === 0,
  "xs:col-span-1 xs:min-h-[250px]": props.collectionCount % 2 !== 0,
  "lg:col-span-4 lg:min-h-[160px]": props.collectionCount % 4 === 0,
  "lg:col-span-3 lg:min-h-[250px] xl:min-h-[260px]": props.collectionCount % 4 === 1,
  "lg:col-span-2 lg:min-h-[250px] xl:min-h-[260px]": props.collectionCount % 4 === 2,
  "lg:col-span-1 lg:min-h-[250px] xl:min-h-[260px]": props.collectionCount % 4 === 3,
}));

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
  background-color: var(--slk-blue-tint, #e6f1f5);
  border-color: var(--slk-border, #d9dfd3);
  color: var(--slk-text, #505050);
}

.data-products-coming-soon h3 {
  color: var(--slk-blue, #006e94);
}
</style>
