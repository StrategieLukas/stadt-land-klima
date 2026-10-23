<script setup lang="ts">
import { singleRouteValue } from "~/shared/routeValues";
import { sectors } from "~/shared/domain";
const route = useRoute();
const sector = singleRouteValue(route.params.sector);
const catalog = singleRouteValue(route.query.v);
if (!sector || !sectors.some((value) => value === sector))
  throw createError({ statusCode: 404, statusMessage: "Sector not found" });
await navigateTo({ path: "/measures", query: { sector, v: catalog } }, { redirectCode: 301 });
</script>
<template><div /></template>
