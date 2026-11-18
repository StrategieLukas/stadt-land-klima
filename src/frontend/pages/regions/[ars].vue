<template>
  <main class="mx-auto w-full max-w-4xl min-w-0 py-4 text-(--slk-text) sm:py-8" :aria-busy="areaLoading || listLoading">
    <p v-if="areaLoading || listLoading" class="sr-only" role="status">{{ $t("generic.loading") }}</p>
    <div class="rounded-lg border border-(--slk-border) bg-(--slk-surface) shadow-lg">
      <nav
        v-if="ancestors.length"
        class="breadcrumbs ms-0 overflow-x-auto rounded-t-lg bg-(--slk-surface) px-4 py-3 text-sm"
      >
        <ul>
          <li v-for="ancestor in ancestors" :key="ancestor.ars">
            <NuxtLink :to="`/regions/${ancestor.ars}`" class="whitespace-nowrap hover:underline">
              {{ ancestor.prefix }} {{ ancestor.name }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
      <div
        v-else-if="areaLoading"
        class="flex h-11 items-center rounded-t-lg bg-(--slk-surface) px-4"
        aria-hidden="true"
      >
        <div class="h-4 w-64 max-w-full skeleton animate-none" />
      </div>
      <header
        class="flex flex-col justify-between gap-4 rounded-b-lg bg-(--slk-surface) p-4 sm:p-6 lg:flex-row"
        :class="{ 'rounded-t-lg': !ancestors.length && !areaLoading }"
      >
        <template v-if="area">
          <div class="min-w-0">
            <h1 class="mb-4 font-heading text-4xl font-black wrap-break-word text-(--slk-text-strong) sm:text-6xl">
              {{ area.name }}
            </h1>
            <p class="text-lg text-(--slk-text)">
              {{ area.prefix }}<span v-if="stateName"> · {{ stateName }}</span>
            </p>
          </div>
          <dl class="shrink-0 space-y-3 text-sm lg:text-right">
            <div>
              <dt class="text-(--slk-text-muted)">{{ $t("region.ars_label") }}</dt>
              <dd class="font-mono">{{ area.ars }}</dd>
            </div>
            <div>
              <dt class="text-(--slk-text-muted)"><RegionMunicipalityCountLabel /></dt>
              <dd class="font-bold">
                <span
                  v-if="regionLoading"
                  class="inline-block h-5 w-10 skeleton animate-none"
                  aria-hidden="true"
                /><template v-else>{{ regionData && !regionError ? municipalities.length : "—" }}</template>
              </dd>
            </div>
          </dl>
        </template>
        <template v-else>
          <div class="min-w-0 flex-1">
            <h1 class="sr-only">{{ $t("generic.loading") }}</h1>
            <div class="mb-4 h-10 w-72 max-w-full skeleton animate-none sm:h-15" aria-hidden="true" />
            <div class="h-7 w-56 max-w-full skeleton animate-none" aria-hidden="true" />
          </div>
          <dl class="shrink-0 space-y-3 text-sm lg:text-right">
            <div>
              <dt class="text-(--slk-text-muted)">{{ $t("region.ars_label") }}</dt>
              <dd class="font-mono">{{ ars }}</dd>
            </div>
            <div>
              <dt class="text-(--slk-text-muted)"><RegionMunicipalityCountLabel /></dt>
              <dd><span class="inline-block h-5 w-10 skeleton animate-none" aria-hidden="true" /></dd>
            </div>
          </dl>
        </template>
      </header>
    </div>

    <section class="mt-6" :aria-label="$t('data.dashboard.map')">
      <ClientOnly v-if="regionData && metric && selection && !regionError">
        <MunicipalityOverviewMap
          :key="regionData.context.snapshot_id"
          :context="regionData.context"
          :metric="metric"
          :color-mode="metric.default_color_mode"
          :selected-bin="null"
          :ars-prefix="selection.prefix"
          :bounds="regionData.bounds"
          compact
          boundaries-only
          @stale="refreshRegion()"
        />
        <template #fallback><div class="h-80 skeleton animate-none rounded-lg sm:h-96" aria-hidden="true" /></template>
      </ClientOnly>
      <div v-else-if="regionLoading" class="h-80 skeleton animate-none rounded-lg sm:h-96" aria-hidden="true" />
    </section>

    <section class="mt-6 overflow-hidden rounded-lg border border-(--slk-border) bg-(--slk-surface) shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-(--slk-border) p-4">
        <h2 class="font-heading text-2xl font-bold text-(--slk-text-strong)">{{ $t("region.ranking_title") }}</h2>
        <span v-if="selectedCatalogVersion" class="font-mono text-xs text-(--slk-text-muted)">{{
          selectedCatalogVersion.name
        }}</span>
        <span v-else-if="rankingLoading" class="h-4 w-12 skeleton animate-none" aria-hidden="true" />
        <label class="input w-full bg-(--slk-surface-subdued)">
          <Icon icon="mdi:magnify" class="h-5 w-5 shrink-0" />
          <input
            v-model="query"
            type="search"
            :placeholder="$t('region.search_municipalities')"
            :aria-label="$t('region.search_municipalities')"
            :disabled="listLoading"
          />
        </label>
        <p class="w-full text-sm text-(--slk-text-muted)">{{ $t("region.eligible_municipalities") }}</p>
      </div>

      <div v-if="listLoading" class="divide-y divide-(--slk-border)" aria-hidden="true">
        <div v-for="row in 6" :key="row" class="flex min-h-24 items-center gap-3 p-4 sm:min-h-18">
          <div class="h-5 w-8 shrink-0 skeleton animate-none" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-5 w-48 max-w-full skeleton animate-none" />
            <div class="h-3 w-28 max-w-full skeleton animate-none" />
          </div>
          <div class="hidden h-6 w-32 skeleton animate-none sm:block" />
        </div>
      </div>
      <div v-else-if="regionError" class="p-6 text-center" role="alert">
        <p>{{ $t("region.loading_error") }}</p>
        <button type="button" class="btn mt-3 btn-sm" @click="refreshRegion()">{{ $t("data.dashboard.retry") }}</button>
      </div>
      <template v-else>
        <div v-if="rankingError" class="border-b border-(--slk-border) p-4" role="alert">
          <p>{{ $t("region.ranking_error") }}</p>
          <button type="button" class="btn mt-2 btn-sm" @click="refreshRanking()">
            {{ $t("data.dashboard.retry") }}
          </button>
        </div>
        <ol v-if="filteredMunicipalities.length" class="divide-y divide-(--slk-border)">
          <li
            v-for="municipality in visibleMunicipalities"
            :key="municipality.ars"
            class="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 p-4 hover:bg-(--slk-surface-subdued) sm:flex"
          >
            <span class="w-8 shrink-0 text-center text-sm text-(--slk-text-muted)">{{
              municipality.rank ? `#${municipality.rank}` : "—"
            }}</span>
            <div class="min-w-0 flex-1">
              <NuxtLink
                :to="municipalityProductRoute('stadtlandklima', municipality)"
                class="font-semibold wrap-break-word hover:underline"
                >{{ municipality.name }}</NuxtLink
              >
              <p class="text-xs text-(--slk-text-muted)">{{ municipality.prefix }}</p>
            </div>
            <span v-if="municipality.score !== null" class="col-start-2 text-sm font-bold text-(--slk-success-text)"
              >{{ municipality.score.toLocaleString($locale, { maximumFractionDigits: 1 }) }}
              <span class="font-normal">{{ $t("stats.points_abbrev") }}</span></span
            >
            <div class="col-start-2 flex flex-wrap gap-2">
              <NuxtLink
                v-if="municipality.ratingSlug"
                :to="{ path: `/municipalities/${municipality.ratingSlug}`, query: { v: selectedCatalogVersion?.name } }"
                class="slk-badge slk-badge--success slk-badge-action px-2.5 py-1 text-xs"
                >{{ $t("region.view_rating") }}</NuxtLink
              >
              <NuxtLink
                :to="municipalityProductRoute('stadtlandklima', municipality)"
                class="slk-badge slk-badge--info slk-badge-action px-2.5 py-1 text-xs"
                >{{ $t("stats.view_stats") }}</NuxtLink
              >
            </div>
          </li>
        </ol>
        <p v-else class="p-12 text-center text-(--slk-text-muted)">{{ $t("region.no_municipalities") }}</p>
        <div
          v-if="visibleMunicipalities.length < filteredMunicipalities.length"
          class="border-t border-(--slk-border) p-4 text-center"
        >
          <button type="button" class="btn btn-sm" @click="visibleCount += 50">
            {{ $t("data.dashboard.load_more") }}
          </button>
        </div>
      </template>
    </section>
  </main>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { AreaSchema, type Area } from "~/shared/contracts/search";
import { RegionMunicipalitiesResponseSchema } from "~/shared/contracts/regionMunicipalities";
import type { Statistics } from "~/shared/contracts/municipality";
import { singleRouteValue } from "~/shared/routeValues";
import { municipalityProductRoute } from "~/utils/municipalityOverview";
import { regionSelection } from "~/utils/regionMunicipalities";

definePageMeta({ key: (route) => `${route.path}:${singleRouteValue(route.query.v) ?? ""}` });
const route = useRoute();
const ars = singleRouteValue(route.params.ars);
if (!ars || !/^\d{2,12}$/.test(ars)) throw createError({ statusCode: 404, statusMessage: "Region not found" });
const { $t, $locale } = useNuxtApp();
const fetchContent = useContentFetch();
const requestFetch = useRequestFetch();
const catalogueRoute = { query: { ...route.query } };
const requestedCatalog = singleRouteValue(route.query.v) ?? "current";
const [
  { data: area, error: areaError },
  { data: rankings, error: rankingError, refresh: refreshRanking },
  { data: regionData, error: regionError, refresh: refreshRegion },
] = await Promise.all([
  useLazyAsyncData(`region-area:${ars}`, async (_app, { signal }) => {
    let result: Area | null;
    try {
      const response = await requestFetch("/api/area-by-slug", {
        query: { slug: ars },
        signal,
        timeout: 10000,
        retry: 0,
      });
      result = AreaSchema.nullable().parse(response ?? null);
    } catch {
      throw createError({ statusCode: 502, statusMessage: "Region unavailable" });
    }
    if (!result) throw createError({ statusCode: 404, statusMessage: "Region not found" });
    return result;
  }),
  useLazyAsyncData(`region-ranking-data:${requestedCatalog}:${$locale}`, async (_app, { signal }) => {
    const catalog = await getCatalogVersion(catalogueRoute);
    const statistics = await fetchContent<Statistics>(`/api/public/stats/${encodeURIComponent(catalog.name)}`, {
      signal,
    });
    return { catalog, statistics };
  }),
  useLazyAsyncData(`region-municipalities:${ars}:${$locale}`, async (_app, { signal }) =>
    RegionMunicipalitiesResponseSchema.parse(
      await requestFetch(`/api/public/regions/${ars}`, {
        query: { lang: $locale === "en-GB" ? "en-US" : $locale },
        signal,
        timeout: 40000,
        retry: 0,
      }),
    ),
  ),
]);
watch(
  areaError,
  (error) => {
    if (error) showError(error);
  },
  { immediate: true },
);
const nuxtApp = useNuxtApp();
watch(
  area,
  (value) => {
    if (value && (value.is_reasonable_for_municipal_rating || (value.level ?? 0) > 4))
      void nuxtApp.runWithContext(() => navigateTo(`/data/${ars}`, { replace: true }));
  },
  { immediate: true },
);
const areaLoading = computed(() => !area.value && !areaError.value);
const regionLoading = computed(() => !regionData.value && !regionError.value);
const rankingLoading = computed(() => !rankings.value && !rankingError.value);
const listReady = ref(false);
watch(
  [regionData, rankings, rankingError],
  () => {
    if (regionData.value && (rankings.value || rankingError.value)) listReady.value = true;
  },
  { immediate: true },
);
const listLoading = computed(() => !regionError.value && (regionLoading.value || !listReady.value));
const selectedCatalogVersion = computed(() => rankings.value?.catalog);
const selection = computed(() => {
  const level = area.value?.level;
  return area.value && level != null && level >= 1 && level <= 4 ? regionSelection(area.value.ars, level) : null;
});
const ancestors = computed(() => [...(area.value?.contained_by ?? [])].sort((a, b) => a.level - b.level));
const stateName = computed(() => ancestors.value.find((ancestor) => ancestor.level === 2)?.name);
const metric = computed(() =>
  regionData.value?.context.metrics.find((metric) => metric.id === regionData.value?.context.metric_id),
);
const municipalities = computed(() => regionData.value?.municipalities ?? []);
const collator = new Intl.Collator($locale, { numeric: true, sensitivity: "base" });
const rankedMunicipalities = computed(() => {
  const scores = new Map(
    (rankings.value?.statistics.scores ?? [])
      .filter((score) => score.published === true && Number(score.percentage_rated) >= 98 && score.score_total !== null)
      .map((score) => [score.municipality.ars, score]),
  );
  return municipalities.value
    .map((municipality) => {
      const rating = scores.get(municipality.ars);
      const slug = rating?.municipality.slug;
      return {
        ...municipality,
        score: rating?.score_total ?? null,
        ratingSlug: slug && /^[a-z0-9_-]+$/.test(slug) ? slug : null,
      };
    })
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || collator.compare(a.name, b.name))
    .map((municipality, index) => ({ ...municipality, rank: municipality.score === null ? null : index + 1 }));
});
const query = ref("");
const visibleCount = ref(50);
watch(query, () => {
  visibleCount.value = 50;
});
const filteredMunicipalities = computed(() =>
  rankedMunicipalities.value.filter((municipality) =>
    `${municipality.name} ${municipality.prefix}`
      .toLocaleLowerCase($locale)
      .includes(query.value.trim().toLocaleLowerCase($locale)),
  ),
);
const visibleMunicipalities = computed(() => filteredMunicipalities.value.slice(0, visibleCount.value));
usePageSeo({
  title: computed(() => (area.value ? `${area.value.prefix} ${area.value.name}` : $t("region.title_fallback"))),
});
</script>
