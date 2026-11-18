<template>
  <div class="w-full pb-12 text-(--slk-text)">
    <header class="mx-auto w-full max-w-(--breakpoint-xl) py-6 sm:py-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t("data.overview.title") }}</h1>
      <p v-if="!underConstruction" class="max-w-3xl text-lg leading-relaxed text-gray">
        {{ $t("data.dashboard.intro") }}
      </p>
    </header>
    <section
      v-if="underConstruction"
      class="mx-auto w-full max-w-(--breakpoint-xl) rounded-lg border-2 border-(--slk-border) bg-(--slk-surface-subdued) p-6 sm:p-8"
      aria-labelledby="data-construction-title"
    >
      <h2 id="data-construction-title" class="font-heading text-3xl font-bold text-stats-dark">
        {{ $t("data.construction.title") }}
      </h2>
      <p class="mt-4 max-w-3xl text-lg leading-relaxed whitespace-pre-line">
        {{ dataPageConfig.under_construction_explanation || $t("data.construction.explanation") }}
      </p>
    </section>

    <section
      v-else
      id="data-explorer"
      class="data-dashboard"
      :aria-busy="loading"
      aria-labelledby="data-explorer-title"
    >
      <div class="data-dashboard-visuals">
        <div class="data-dashboard-left">
          <section
            id="data-collections"
            class="data-dashboard-products data-dashboard-panel min-w-0 scroll-mt-28"
            aria-labelledby="data-products-title"
          >
            <h2 id="data-products-title" class="mb-3 font-heading text-xl font-bold">
              {{ $t("data.dashboard.choose_product") }}
            </h2>
            <button
              type="button"
              class="btn mb-3 w-full justify-between btn-outline text-left md:hidden"
              :aria-expanded="chooserOpen"
              :title="$t(chooserOpen ? 'generic.collapse' : 'generic.expand')"
              aria-controls="data-product-picker"
              @click="chooserOpen = !chooserOpen"
            >
              <span class="truncate">{{
                selectedCollection ? t(selectedCollection.title) : $t("data.dashboard.choose_product")
              }}</span>
              <span aria-hidden="true">{{ chooserOpen ? "−" : "+" }}</span>
            </button>
            <div
              id="data-product-picker"
              :class="chooserOpen ? '' : 'hidden md:block'"
              role="group"
              :aria-label="$t('data.dashboard.choose_product')"
            >
              <DataProductMatrix v-if="visibleCollections.length" :count="visibleCollections.length">
                <DataProductsOverviewGridCard
                  v-for="collection in visibleCollections"
                  :key="collection.id"
                  :collection="collection"
                  ars=""
                  :base-url="baseUrl"
                  :show-kpi="false"
                  compact
                  :expanded="selectedCollection?.id === collection.id"
                  @select="selectProduct(collection.id)"
                />
                <DataProductsComingSoonTile compact :collection-count="visibleCollections.length" />
              </DataProductMatrix>
              <p v-else role="status">
                {{ $t(manifestError ? "generic.loading_error" : "data.overview.unavailable") }}
              </p>
            </div>
          </section>
          <div v-if="loading || context" class="data-dashboard-histogram data-dashboard-panel min-w-0">
            <h2 class="mb-3 font-heading text-xl font-bold">{{ $t("data.dashboard.distribution") }}</h2>
            <template v-if="context && metric">
              <HistogramRenderElement
                :key="context.snapshot_id"
                :element="context.histogram"
                :collection-id="context.collection"
                :snapshot="context.snapshot_id"
                :export-title="t(metric.title)"
                :export-area-name="context.scope.name"
                :export-attribution="exportAttribution"
                @select-bin="selectedBin = $event"
                @stale="refreshSnapshot"
              />
            </template>
            <div v-else-if="loading" role="status" :aria-label="$t('generic.loading')" aria-busy="true">
              <div
                class="h-60 w-full animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none"
                aria-hidden="true"
              />
              <div
                class="mt-2 h-4 w-40 animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none"
                aria-hidden="true"
              />
              <div
                class="mt-2 h-5 w-48 max-w-full animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none"
                aria-hidden="true"
              />
            </div>
            <p v-else role="status">{{ $t("data.dashboard.no_comparison") }}</p>
          </div>
        </div>
        <div class="data-dashboard-right">
          <div v-if="loading || context" class="data-dashboard-controls data-dashboard-panel min-w-0 space-y-3">
            <p v-if="announcement" role="status">{{ $t(announcement) }}</p>
            <template v-if="context && metric">
              <div class="grid grid-cols-2 gap-3">
                <label v-if="context.metrics.length > 1" class="col-span-2 text-sm font-semibold"
                  >{{ $t("data.dashboard.metric") }}
                  <select
                    class="select mt-1 w-full select-sm"
                    :aria-label="$t('data.dashboard.metric')"
                    :value="context.metric_id"
                    @change="changeMetric"
                  >
                    <option v-for="item in context.metrics" :key="item.id" :value="item.id">{{ t(item.title) }}</option>
                  </select>
                </label>
                <label class="text-sm font-semibold"
                  >{{ $t("data.dashboard.state") }}
                  <select
                    class="select mt-1 w-full select-sm"
                    :aria-label="$t('data.dashboard.state')"
                    :value="stateArs"
                    :disabled="regionsLoading || regionsFailed"
                    @change="changeState"
                  >
                    <option value="">{{ $t("data.dashboard.germany") }}</option>
                    <option v-for="region in states" :key="region.ars" :value="region.ars">{{ region.name }}</option>
                  </select>
                </label>
                <label class="text-sm font-semibold"
                  >{{ $t("data.dashboard.district") }}
                  <select
                    class="select mt-1 w-full select-sm"
                    :aria-label="$t('data.dashboard.district')"
                    :value="districtArs"
                    :disabled="!stateArs || regionsLoading || regionsFailed"
                    @change="changeDistrict"
                  >
                    <option value="">{{ $t("data.dashboard.all_districts") }}</option>
                    <option v-for="region in districts" :key="region.ars" :value="region.ars">{{ region.name }}</option>
                  </select>
                </label>
              </div>
              <p v-if="regionsFailed" class="text-sm" role="alert">{{ $t("data.dashboard.regions_unavailable") }}</p>

              <MunicipalityOverviewSearch
                :collection-id="context.collection"
                :url="context.links.municipalities"
                :snapshot="context.snapshot_id"
                :metric="metric"
                @stale="refreshSnapshot"
              />

              <div v-if="metric.color_modes.length > 1" class="join" :aria-label="$t('data.dashboard.color_mode')">
                <button
                  v-for="mode in metric.color_modes"
                  :key="mode"
                  type="button"
                  class="btn join-item btn-sm"
                  :class="{ 'btn-active': colorMode === mode }"
                  :aria-pressed="colorMode === mode"
                  @click="updateQuery({ color: mode })"
                >
                  {{ $t(`data.dashboard.color_${mode}`) }}
                </button>
              </div>
            </template>
            <div
              v-else-if="loading"
              class="space-y-3"
              role="status"
              :aria-label="$t('generic.loading')"
              aria-busy="true"
            >
              <div class="grid grid-cols-2 gap-3" aria-hidden="true">
                <div v-for="index in 2" :key="index">
                  <div class="h-5 w-20 animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none" />
                  <div class="mt-1 h-8 w-full animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none" />
                </div>
              </div>
              <div aria-hidden="true">
                <div class="mb-1 h-5 w-32 animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none" />
                <div class="h-10 w-full animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none" />
              </div>
              <div
                class="h-8 w-44 animate-pulse rounded-sm bg-gray-200 motion-reduce:animate-none"
                aria-hidden="true"
              />
            </div>
          </div>
          <div v-if="loading || selectedCollection" id="data-map" class="data-dashboard-map min-w-0 scroll-mt-28">
            <template v-if="context && metric">
              <div class="data-overview-map-size rounded-lg bg-gray-200">
                <ClientOnly
                  ><MunicipalityOverviewMap
                    :context="context"
                    :metric="metric"
                    :color-mode="colorMode"
                    :selected-bin="selectedBin"
                    @stale="refreshSnapshot" /><template #fallback><MunicipalityOverviewMapPlaceholder /></template
                ></ClientOnly>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-3 text-xs" :aria-label="$t('data.dashboard.legend')">
                <template v-if="colorMode === 'score'"
                  ><span
                    v-for="item in metric.score_scale?.classes"
                    :key="item.id"
                    class="inline-flex items-center gap-1.5"
                    ><i class="h-3 w-3 rounded-sm" :style="{ backgroundColor: item.color }" />{{ t(item.label) }}</span
                  ></template
                >
                <div v-else class="w-64 max-w-full">
                  <div
                    class="h-3 rounded-sm"
                    :style="{ background: continuousGradient }"
                    :aria-label="$t('data.dashboard.legend')"
                    role="img"
                  />
                  <div class="mt-1 flex justify-between gap-3">
                    <span>{{
                      formatOverviewValue(metric.continuous_scale?.stops[0]?.value ?? null, metric, $locale)
                    }}</span><span>{{
                      formatOverviewValue(metric.continuous_scale?.stops.at(-1)?.value ?? null, metric, $locale)
                    }}</span>
                  </div>
                </div>
                <span class="inline-flex items-center gap-1.5"
                  ><i class="h-3 w-3 rounded-sm" :style="{ backgroundColor: context.map.no_data_color }" />{{
                    $t("generic.no_data")
                  }}</span
                >
              </div>
            </template>
            <MunicipalityOverviewMapPlaceholder v-else :state="loading ? 'loading' : failed ? 'error' : 'pending'" />
          </div>
        </div>
      </div>
      <section
        class="data-dashboard-information data-dashboard-panel mx-auto w-full max-w-(--breakpoint-xl) min-w-0 space-y-4"
        aria-labelledby="data-explorer-title"
        :aria-busy="metadataStatus === 'pending'"
      >
        <h2 id="data-explorer-title" class="font-heading text-2xl font-bold text-stats-dark">{{ productTitle }}</h2>
        <p v-if="metadataError" class="text-sm" role="alert">
          {{ $t("data.dashboard.product_info_unavailable") }}
          <button type="button" class="underline" @click="refreshMetadata()">{{ $t("data.dashboard.retry") }}</button>
        </p>
        <div
          v-if="metadataStatus === 'pending'"
          class="h-32 animate-pulse rounded-lg bg-gray-200 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <section v-for="section in descriptionSections" :key="section.id" class="space-y-1">
          <h3 v-if="section.title" class="font-heading text-lg font-bold">{{ section.title }}</h3>
          <p
            v-for="paragraph in section.paragraphs"
            :key="paragraph"
            class="text-sm leading-relaxed whitespace-pre-line"
          >
            {{ paragraph }}
          </p>
        </section>
        <p v-if="context?.status === 'no_data'" role="status">{{ $t("generic.no_data") }}</p>
        <div v-if="loading || context" class="min-w-0">
          <template v-if="context && metric">
            <div class="grid grid-cols-2 gap-2">
              <div v-for="stat in coverage" :key="stat.label" class="rounded-lg bg-(--slk-surface-subdued) p-2.5">
                <span class="block text-xs text-(--slk-text-subtle)">{{ $t(stat.label) }}</span><strong
                  class="mt-1 block text-xl tabular-nums"
                  >{{ stat.value }}</strong
                >
              </div>
            </div>
          </template>
          <div v-else-if="loading" class="grid grid-cols-2 gap-2" aria-hidden="true">
            <div
              v-for="index in 4"
              :key="index"
              class="h-[68px] animate-pulse rounded-lg bg-gray-200 motion-reduce:animate-none"
            />
          </div>
        </div>

        <AttributionBlock
          :collection="informationCollection"
          :fallback-attribution="t(context?.attribution)"
          embedded
        />
        <template v-if="context">
          <footer class="space-y-2 border-t border-(--slk-border) pt-3 text-xs text-(--slk-text-subtle)">
            <p v-if="context.update_info.last_updated_at">
              {{ $t("data.dashboard.updated") }}:
              {{
                new Intl.DateTimeFormat($locale, { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(
                  new Date(context.update_info.last_updated_at),
                )
              }}
            </p>
            <p v-if="context.update_info.quality_label">{{ t(context.update_info.quality_label) }}</p>
            <p v-else>
              {{ $t("data.dashboard.verification") }}:
              {{
                $t(
                  context.update_info.verification_status === "verified"
                    ? "data.dashboard.verified"
                    : "data.dashboard.quality_limited",
                )
              }}
            </p>
          </footer>
        </template>
        <div v-if="!context && !loading" class="mt-6 space-y-4">
          <p role="status">{{ $t(failed ? "data.dashboard.unavailable" : "data.dashboard.no_comparison") }}</p>
          <button v-if="failed" type="button" class="btn btn-outline btn-sm" @click="load()">
            {{ $t("data.dashboard.retry") }}
          </button>
          <AdministrativeAreaSearchBar
            reasonable-munips-to-rate="include"
            :placeholder="$t('data.dashboard.search_placeholder')"
            :route-builder="fallbackRoute"
          />
        </div>
      </section>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { CollectionSchema, CollectionsResponseSchema } from "~/shared/contracts/slz";
import { formatDataAttribution, resolveDataAttribution } from "~/utils/dataAttribution";
import {
  MunicipalityOverviewSchema,
  OverviewRegionsSchema,
  OverviewScopeSchema,
  type MunicipalityOverview,
  type OverviewColorMode,
  type OverviewRegion,
} from "~/shared/contracts/municipalityOverview";
import {
  checkedOverviewUrl,
  formatOverviewValue,
  municipalityProductRoute,
  overviewEndpoint,
} from "~/utils/municipalityOverview";
import { singleRouteValue } from "~/shared/routeValues";
import { areaToSlug } from "~/composables/useAreaBySlug";
import type { AreaResult } from "~/types/components/navigation";
import { isCollectionVisible } from "~/utils/dataPageVisibility";
import { normalizeCollection } from "~/utils/dataProducts";
definePageMeta({ contentWidth: "full" });
const { $t, $locale } = useNuxtApp();
const { t } = useSlzLocale();
const route = useRoute();
const router = useRouter();
const baseUrl = useRuntimeConfig().public.stadtlandzahlBaseUrl;
const { data: dataPageConfig } = await useDataPageConfig();
const underConstruction = computed(() => dataPageConfig.value.under_construction);
const manifestError = ref(false);
const { data: collections } = await useAsyncData(
  "data-overview-collections",
  async () => {
    if (underConstruction.value) return [];
    try {
      const manifest = CollectionsResponseSchema.parse(
        await $fetch(`${baseUrl}/api/manifests/collections-index`, { timeout: 8000 }),
      );
      manifestError.value = false;
      return manifest.collections.map(normalizeCollection);
    } catch {
      manifestError.value = true;
      return [];
    }
  },
  { default: () => [], watch: [underConstruction] },
);
const visibleCollections = computed(() =>
  collections.value.filter((collection) => isCollectionVisible(collection.id, dataPageConfig.value)),
);
const selectedCollection = computed(
  () =>
    visibleCollections.value.find((collection) => collection.id === singleRouteValue(route.query.product)) ??
    visibleCollections.value.find(
      (collection) => collection.id === "stadtlandklima" && collection.municipality_overview,
    ) ??
    visibleCollections.value.find((collection) => collection.municipality_overview) ??
    visibleCollections.value[0],
);
const metadataKey = computed(
  () =>
    `data-product-metadata:${JSON.stringify([underConstruction.value ? null : selectedCollection.value?.id, $locale])}`,
);
const metadataTask = useAsyncData(
  metadataKey,
  async (_app, { signal }) => {
    const id = underConstruction.value ? undefined : selectedCollection.value?.id;
    if (!id) return { collectionId: null, collection: null };
    const collection = CollectionSchema.parse(
      await $fetch(`${baseUrl}/api/collections/${encodeURIComponent(id)}/`, {
        query: { metadata_only: "true" },
        signal,
        timeout: 10000,
        retry: 0,
      }),
    );
    if (collection.id !== id) throw new Error("Mismatched product metadata");
    return { collectionId: id, collection: normalizeCollection(collection) };
  },
  { dedupe: "cancel" },
);
const chooserOpen = ref(false);
const selectedBin = ref<number | null>(null);
const announcement = ref<"data.dashboard.snapshot_updated" | "">("");
const request = computed(() => {
  const collection = selectedCollection.value;
  const requestedMetric = singleRouteValue(route.query.metric);
  const scope = OverviewScopeSchema.safeParse(singleRouteValue(route.query.scope) ?? "DE");
  return {
    collection: underConstruction.value ? undefined : collection?.municipality_overview ? collection.id : undefined,
    metric:
      requestedMetric && /^[a-zA-Z0-9_-]{1,160}$/.test(requestedMetric)
        ? requestedMetric
        : collection?.municipality_overview?.default_metric_id,
    scope: scope.success ? scope.data : "DE",
    lang: $locale === "en-GB" ? "en-US" : $locale,
  };
});
const overviewKey = computed(() => `municipality-overview:${JSON.stringify(request.value)}`);
let canonicalHandoff: OverviewResult | undefined;
interface OverviewResult {
  requestKey: string;
  context: MunicipalityOverview | null;
  states: OverviewRegion[];
  districts: OverviewRegion[];
  regionsFailed: boolean;
  regionsStale: boolean;
}
const overviewTask = useAsyncData(
  overviewKey,
  async (_app, { signal }): Promise<OverviewResult> => {
    const requestKey = overviewKey.value;
    const params = { ...request.value };
    const defaultMetric = selectedCollection.value?.municipality_overview?.default_metric_id;
    const collection = params.collection;
    const empty: OverviewResult = {
      requestKey,
      context: null,
      states: [],
      districts: [],
      regionsFailed: false,
      regionsStale: false,
    };
    if (!collection) return empty;
    let raw: unknown;
    try {
      raw = await $fetch(overviewEndpoint(collection), {
        query: { metric: params.metric, scope: params.scope, lang: params.lang },
        signal,
        timeout: 10000,
        retry: 0,
      });
    } catch (failure) {
      const reason = (failure as { data?: { code?: string } }).data?.code;
      const code =
        (failure as { statusCode?: number; status?: number }).statusCode ?? (failure as { status?: number }).status;
      if (
        (code === 503 && reason === "projection_unavailable") ||
        (code === 404 && reason === "overview_not_configured")
      )
        return empty;
      if (code !== 400) throw failure;
      params.metric = defaultMetric;
      params.scope = "DE";
      raw = await $fetch(overviewEndpoint(collection), {
        query: { metric: params.metric, scope: params.scope, lang: params.lang },
        signal,
        timeout: 10000,
        retry: 0,
      });
    }
    const context = MunicipalityOverviewSchema.parse(raw);
    if (context.collection !== collection || context.metric_id !== params.metric || context.scope.ars !== params.scope)
      throw new Error("Mismatched overview context");
    checkedOverviewUrl(context.map.tile_url, collection, "tiles", context.snapshot_id);
    checkedOverviewUrl(context.histogram.data_url ?? "", collection, "histogram", context.snapshot_id);
    checkedOverviewUrl(context.links.municipalities, collection, "municipalities", context.snapshot_id);
    const regionsUrl = checkedOverviewUrl(context.links.regions, collection, "regions", context.snapshot_id);
    const result: OverviewResult = { ...empty, context };
    try {
      const pages = await Promise.all([
        $fetch(regionsUrl, { query: { level: "state" }, signal, timeout: 10000, retry: 0 }),
        context.scope.state_ars
          ? $fetch(regionsUrl, {
              query: { level: "district", parent_ars: context.scope.state_ars },
              signal,
              timeout: 10000,
              retry: 0,
            })
          : Promise.resolve({ snapshot_id: context.snapshot_id, results: [] }),
      ]);
      const [states, districts] = pages.map((page) => OverviewRegionsSchema.parse(page));
      if (states!.snapshot_id !== context.snapshot_id || districts!.snapshot_id !== context.snapshot_id)
        throw new Error("Mismatched region context");
      result.states = states!.results;
      result.districts = districts!.results;
    } catch (failure) {
      if (signal.aborted) throw failure;
      result.regionsFailed = true;
      result.regionsStale =
        (failure as { statusCode?: number; status?: number }).statusCode === 409 ||
        (failure as { status?: number }).status === 409;
    }
    return result;
  },
  {
    dedupe: "cancel",
    getCachedData: (key, app) => {
      if (app.isHydrating) return app.payload.data[key] as OverviewResult | undefined;
      if (canonicalHandoff?.requestKey === key) {
        const result = canonicalHandoff;
        canonicalHandoff = undefined;
        return result;
      }
      return undefined;
    },
  },
);
const [overviewState, metadataState] = await Promise.all([overviewTask, metadataTask]);
const { data: overview, status, error, refresh: load } = overviewState;
const { data: metadata, status: metadataStatus, error: metadataError, refresh: refreshMetadata } = metadataState;
const productMetadata = computed(() =>
  !underConstruction.value &&
  metadataStatus.value !== "pending" &&
  metadata.value?.collectionId === selectedCollection.value?.id
    ? metadata.value?.collection
    : null,
);
const informationCollection = computed(() => productMetadata.value ?? selectedCollection.value);
const productTitle = computed(() => t(informationCollection.value?.title) || $t("data.overview.title"));
// A reactive key can briefly retain the previous result; never display it for a new request.
const currentOverview = computed(() =>
  status.value !== "pending" && overview.value?.requestKey === overviewKey.value ? overview.value : null,
);
const context = computed(() => currentOverview.value?.context ?? null);
const loading = computed(() => status.value === "pending");
const failed = computed(() => !!error.value);
const states = computed(() => currentOverview.value?.states ?? []);
const districts = computed(() => currentOverview.value?.districts ?? []);
const regionsFailed = computed(() => currentOverview.value?.regionsFailed ?? false);
const regionsLoading = loading;
const metric = computed(() => context.value?.metrics.find((item) => item.id === context.value?.metric_id) ?? null);
const exportAttribution = computed(() =>
  formatDataAttribution(
    resolveDataAttribution(
      { collection: informationCollection.value, fallbackAttribution: t(context.value?.attribution) },
      t,
    ),
  ),
);
const descriptionSections = computed(() => {
  const collection = informationCollection.value;
  if (!collection) return [];
  const normalize = (text: string) => text.replace(/\s+/gu, " ").trim();
  const suppressedHeadings = new Set([normalize(productTitle.value), normalize($t("data.dashboard.distribution"))]);
  const descriptions = new Set<string>();
  const sections: { id: string; title: string; paragraphs: string[] }[] = [];
  const headingSections = new Map<string, (typeof sections)[number]>();
  const add = (id: string, title: string, description: string) => {
    const text = normalize(description);
    if (!text || descriptions.has(text)) return;
    descriptions.add(text);
    const heading = normalize(title);
    const existing = heading ? headingSections.get(heading) : undefined;
    if (existing) {
      existing.paragraphs.push(description);
      return;
    }
    const section = { id, title: heading && !suppressedHeadings.has(heading) ? title : "", paragraphs: [description] };
    sections.push(section);
    if (heading) headingSections.set(heading, section);
  };
  add("product", productTitle.value, t(collection.description));
  for (const step of [...(collection.narrative_steps ?? [])].sort((a, b) => a.index - b.index))
    add(`step-${step.index}`, t(step.title), t(step.description));
  add("metric", t(metric.value?.title), t(metric.value?.description));
  for (const visual of collection.overview_visuals ?? []) {
    const element = collection.render_elements?.find((item) => item.plot_id === visual.plot_id);
    add(
      `visual-${visual.plot_id}`,
      t(visual.title) || t(element?.title),
      t(visual.description) || t(element?.description),
    );
  }
  add("histogram", t(context.value?.histogram.title), t(context.value?.histogram.description));
  return sections;
});
const colorMode = computed<OverviewColorMode>(
  () =>
    metric.value?.color_modes.find((mode) => mode === route.query.color) ??
    metric.value?.default_color_mode ??
    "continuous",
);
const continuousGradient = computed(() => {
  const stops = metric.value?.continuous_scale?.stops ?? [];
  const minimum = stops[0]?.value ?? 0;
  const maximum = stops.at(-1)?.value ?? 1;
  return `linear-gradient(to right, ${stops.map((stop) => `${stop.color} ${((stop.value - minimum) / (maximum - minimum)) * 100}%`).join(", ")})`;
});
const stateArs = computed(() => context.value?.scope.state_ars ?? "");
const districtArs = computed(() =>
  context.value && context.value.scope.ars !== "DE" && context.value.scope.ars !== stateArs.value
    ? context.value.scope.ars
    : "",
);
const coverage = computed(() =>
  context.value
    ? ([
        { label: "data.dashboard.available_count", value: context.value.cohort.included_count.toLocaleString($locale) },
        { label: "data.dashboard.missing_count", value: context.value.cohort.missing_count.toLocaleString($locale) },
        { label: "data.dashboard.excluded_count", value: context.value.cohort.excluded_count.toLocaleString($locale) },
        {
          label: "data.dashboard.median",
          value: formatOverviewValue(context.value.stats.median, metric.value, $locale) ?? $t("generic.no_data"),
        },
      ] as const)
    : [],
);
let refreshing = false;
let refreshedSnapshot = "";
function updateQuery(values: Record<string, string | undefined>, replace = false) {
  return router[replace ? "replace" : "push"]({ query: { ...route.query, ...values } });
}
async function selectProduct(product: string) {
  chooserOpen.value = false;
  await updateQuery({ product, metric: undefined, color: undefined });
  if (window.matchMedia("(max-width: 767px)").matches) {
    await nextTick();
    document.getElementById("data-map")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }
}
function changeMetric(event: Event) {
  if (event.target instanceof HTMLSelectElement) void updateQuery({ metric: event.target.value, color: undefined });
}
function changeState(event: Event) {
  if (event.target instanceof HTMLSelectElement) void updateQuery({ scope: event.target.value || "DE" });
}
function changeDistrict(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    void updateQuery({ scope: event.target.value || stateArs.value || "DE" });
}
function fallbackRoute(area: AreaResult) {
  if (!/^\d{2,12}$/.test(area.ars)) return null;
  return selectedCollection.value
    ? municipalityProductRoute(selectedCollection.value.id, {
        slug: `${areaToSlug(area.prefix ?? "", area.name)}--${area.ars}`,
      })
    : null;
}
async function refreshSnapshot() {
  const snapshot = context.value?.snapshot_id;
  if (!snapshot || refreshing || refreshedSnapshot === snapshot) return;
  refreshing = true;
  selectedBin.value = null;
  refreshedSnapshot = snapshot;
  try {
    canonicalHandoff = undefined;
    await load();
    if (context.value) announcement.value = "data.dashboard.snapshot_updated";
  } finally {
    refreshing = false;
  }
}
watch(
  overviewKey,
  () => {
    selectedBin.value = null;
    announcement.value = "";
  },
  { flush: "sync" },
);
function normalizeQuery() {
  const active = context.value;
  if (!active || !metric.value) return;
  const values = {
    product: active.collection,
    metric: active.metric_id,
    scope: active.scope.ars,
    color: colorMode.value,
  };
  if (Object.entries(values).some(([key, value]) => route.query[key] !== value)) {
    // Carry only this just-resolved result across query canonicalization, not across later visits.
    const canonicalKey = `municipality-overview:${JSON.stringify({ collection: active.collection, metric: active.metric_id, scope: active.scope.ars, lang: request.value.lang })}`;
    if (canonicalKey !== overviewKey.value && currentOverview.value)
      canonicalHandoff = { ...currentOverview.value, requestKey: canonicalKey };
    void updateQuery(values, true);
  }
}
onMounted(() => {
  normalizeQuery();
  if (currentOverview.value?.regionsStale) void refreshSnapshot();
});
watch([context, colorMode], () => {
  if (import.meta.client) {
    normalizeQuery();
    if (currentOverview.value?.regionsStale) void refreshSnapshot();
  }
});
usePageSeo(() => ({
  title: $t("data.overview.title"),
  description: underConstruction.value
    ? dataPageConfig.value.under_construction_explanation || $t("data.construction.explanation")
    : $t("data.dashboard.intro"),
}));
</script>

<style scoped>
.data-dashboard {
  display: grid;
  gap: 1rem;
}
.data-dashboard-visuals,
.data-dashboard-left,
.data-dashboard-right {
  display: contents;
}
.data-dashboard-panel {
  border: 1px solid var(--slk-border);
  border-radius: 0.5rem;
  background: var(--slk-surface);
  padding: 0.75rem;
}
.data-dashboard-products {
  order: 1;
  min-width: 0;
}
.data-dashboard-controls {
  order: 2;
}
.data-dashboard-map {
  order: 3;
}
.data-dashboard-information {
  order: 4;
  padding-inline: 0.5rem;
}
.data-dashboard-histogram {
  order: 5;
  align-self: start;
}
#data-product-picker {
  margin: -12px;
  padding: 12px;
}
@media (min-width: 640px) {
  .data-dashboard-panel {
    padding: 1rem;
  }
}
@media (min-width: 1024px) {
  .data-dashboard-visuals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    align-items: start;
  }
  .data-dashboard-left,
  .data-dashboard-right {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }
  .data-dashboard-left > *,
  .data-dashboard-right > * {
    order: initial;
    width: 100%;
    margin-inline: 0;
  }
  .data-dashboard-information {
    order: initial;
  }
}
</style>
