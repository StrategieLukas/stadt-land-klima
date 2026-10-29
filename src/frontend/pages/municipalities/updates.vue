<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8">
    <h1 class="mb-4 font-heading text-4xl font-black text-ranking-dark">{{ $t("municipality.updates.title") }}</h1>
    <p class="mb-8 text-lg">{{ $t("municipality.updates.description") }}</p>
    <p v-if="error || loadError" role="alert" class="mb-6 alert">{{ $t("municipality.updates.error") }}</p>
    <p v-if="!updates.length && !error">{{ $t("municipality.updates.empty") }}</p>
    <ol class="space-y-4" data-testid="municipality-updates">
      <li v-for="entry in updates" :key="entry.id" class="rounded-lg border border-base-300 bg-base-100 p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <NuxtLink
            :to="{ path: `/municipalities/${entry.municipality.slug}`, query: { v: entry.catalog } }"
            class="text-xl font-bold underline decoration-light-green underline-offset-4"
            >{{ entry.municipality.name }}</NuxtLink
          >
          <time :datetime="entry.occurred_at" class="text-sm text-base-content/70">{{
            formatDate(entry.occurred_at)
          }}</time>
        </div>
        <p class="mt-2 text-sm">{{ $t(`municipality.updates.kind.${entry.kind}`) }} · {{ entry.catalog }}</p>
        <p class="mt-3 text-2xl font-bold">
          {{ formatScore(entry.score_total) }}
          <span v-if="entry.previous_total !== null" class="ml-2 text-sm font-normal">{{
            $t("municipality.updates.previous", { ":score": formatScore(entry.previous_total) })
          }}</span>
        </p>
      </li>
    </ol>
    <CanonicalButton
      v-if="nextCursor"
      class="mt-8"
      :label="pending ? $t('generic.loading') : $t('municipality.updates.more')"
      :disabled="pending"
      icon-slug="mdi:chevron-down"
      color="bright-green"
      @click="loadMore"
    />
  </div>
</template>
<script setup lang="ts">
import type { MunicipalityUpdates } from "~/shared/contracts/municipalityUpdates";
const { $t, $locale } = useNuxtApp();
const route = useRoute();
const fetchContent = useContentFetch();
const filters = computed(() => ({
  municipality: typeof route.query.municipality === "string" ? route.query.municipality : undefined,
  v: typeof route.query.v === "string" ? route.query.v : undefined,
}));
const { data, error } = await useAsyncData<MunicipalityUpdates>(
  "municipality-updates",
  () => fetchContent<MunicipalityUpdates>("/api/public/municipality-updates", { query: filters.value }),
  { watch: [filters] },
);
const updates = ref(data.value?.updates ?? []);
const nextCursor = ref(data.value?.nextCursor ?? null);
watch(data, (value) => {
  updates.value = value?.updates ?? [];
  nextCursor.value = value?.nextCursor ?? null;
});
const pending = ref(false);
const loadError = ref(false);
async function loadMore() {
  if (!nextCursor.value || pending.value) return;
  pending.value = true;
  loadError.value = false;
  try {
    const page = await fetchContent<MunicipalityUpdates>("/api/public/municipality-updates", {
      query: { ...filters.value, cursor: nextCursor.value },
    });
    const existing = new Set(updates.value.map((entry) => entry.id));
    updates.value.push(...page.updates.filter((entry) => !existing.has(entry.id)));
    nextCursor.value = page.nextCursor;
  } catch {
    loadError.value = true;
  } finally {
    pending.value = false;
  }
}
const formatDate = (value: string) =>
  new Intl.DateTimeFormat($locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(
    new Date(value),
  );
const formatScore = (value: number | null) =>
  new Intl.NumberFormat($locale, { style: "percent", maximumFractionDigits: 1 }).format(Number(value) / 100);
usePageSeo({
  title: () => $t("municipality.updates.title"),
  description: () => $t("municipality.updates.description"),
});
</script>
