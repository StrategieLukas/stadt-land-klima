<template>
  <div>
    <div class="prose mb-8 mt-10 max-w-full text-center">
      <h1 class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }}
      </h1>
      <p class="mt-0 text-xs">
        {{ $t("municipalities.last_updated_at") + lastUpdatedAtStr }}
      </p>
    </div>
    <section>
      <the-ranking :municipalities="municipalities"></the-ranking>
    </section>
  </div>
</template>

<script setup>
import lodash from "lodash";
const { sortBy, last, get } = lodash;
const { $directus, $readItems, $t, $locale } = useNuxtApp();

//MetaTags
const title = ref($t("municipalities.nav_label"));
useHead({
  title,
});
//
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "place", "state", "date_updated"],
      sort: "-score_total",
      limit: -1,
      filter: {
        status: {
          _eq: "published",
        },
      },
    }),
  );
});

const lastUpdatedAtStr = ref("");
onMounted(() => {
  const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ["date_updated"])), "date_updated"));
  lastUpdatedAtStr.value =
    lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
    ", " +
    lastUpdatedAt.toLocaleTimeString($locale);
});
</script>
