<template>
  <div />
</template>

<script setup lang="ts">
import { areaToSlug } from "~/composables/useAreaBySlug";
import { singleRouteValue } from "~/shared/routeValues";

const route = useRoute();
const ars = singleRouteValue(route.params.ars);
if (!ars || !/^\d{2,12}$/.test(ars)) throw createError({ statusCode: 404, statusMessage: "Area not found" });
const area = await $fetch<{ prefix?: string | undefined; name?: string | undefined }>("/api/area-by-slug", {
  params: { slug: ars },
}).catch(() => null);

if (!area?.name) {
  throw createError({ statusCode: 404, statusMessage: "Area not found" });
}

await navigateTo(`/data/${areaToSlug(area.prefix ?? "", area.name)}`, {
  redirectCode: 301,
  replace: true,
});
</script>
