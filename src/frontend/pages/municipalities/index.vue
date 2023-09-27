<template>
  <div>
    <div class="prose mb-8 mt-10 max-w-full text-center">
      <h1 class="mb-0 whitespace-pre-line">
        {{ $t("municipalities.heading") }}
      </h1>
      <p class="mt-0 text-xs">
        {{ $t("municipalities.last_updated_at", { ":updated_at": lastUpdatedAtStr }) }}
      </p>
    </div>
    <div class="mx-auto mb-8 flex justify-center">
      <implementation-traffic-light />
    </div>
    <section>
      <the-ranking :municipalities="municipalities"></the-ranking>
    </section>
  </div>
</template>

<script setup>
import { sortBy, last, get } from "lodash";
const { $directus, $readItems, $t, $locale } = useNuxtApp();

const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name", "score_total", "place", "state", "date_updated"],
      sort: "-score_total",
      limit: -1,
    }),
  );
});

const lastUpdatedAt = new Date(get(last(sortBy(municipalities.value, ["date_updated"])), "date_updated"));
const lastUpdatedAtStr =
  lastUpdatedAt.toLocaleDateString($locale, { year: "numeric", month: "2-digit", day: "numeric" }) +
  ", " +
  lastUpdatedAt.toLocaleTimeString($locale);
</script>
