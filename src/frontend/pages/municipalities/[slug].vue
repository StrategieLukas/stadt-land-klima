<template>
  <!-- PREVIEW_LOCKED: unverified creator, no valid token -->
  <div v-if="pageView === PV.PREVIEW_LOCKED" class="mt-10 mb-8">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
    <div class="mt-6 flex items-start gap-3 border border-(--slk-border) bg-(--slk-orange-tint) p-4">
      <Icon icon="mdi:lock-outline" class="mt-0.5 h-6 w-6 shrink-0 text-(--slk-orange)" :ariaHidden="true" />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base leading-snug font-bold text-gray">
          Zugriff eingeschränkt: „{{ previewMuniName }}“
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          {{ $t("municipalities.preview_locked") }}
        </p>
        <div class="flex flex-wrap gap-2">
          <CanonicalButton
            :label="copiedState.preview ? $t('generic.link_copied') : $t('generic.copy_link')"
            :icon-slug="copiedState.preview ? 'mdi:check' : 'mdi:content-copy'"
            color="orange"
            @click="copyShareLink('preview')"
          />
          <CanonicalButton
            :href="`/contact?title=${encodeURIComponent('Verifizierung Lokalteam ' + previewMuniName)}&type=cooperation&content=${encodeURIComponent('Ich bitte um Verifizierung meines Lokalteam-Accounts für ' + previewMuniName + '.\n\nMeine Kontaktdaten:\n')}`"
            :label="$t('generic.contact')"
            icon-slug="mdi:email-outline"
            color="orange"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- IN_PROGRESS_LOCKED: incomplete rating, requires ?preview=true -->
  <div v-else-if="pageView === PV.IN_PROGRESS_LOCKED && directusData.municipalityScore" class="mt-10 mb-8">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
    <div class="mt-6 flex items-start gap-3 border border-(--slk-border) bg-(--slk-orange-tint) p-4">
      <Icon icon="mdi:progress-pencil" class="mt-0.5 h-6 w-6 shrink-0 text-(--slk-orange)" :ariaHidden="true" />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base leading-snug font-bold text-gray">
          Bewertung noch in Bearbeitung: „{{ directusData.municipalityScore.municipality.name }}"
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          Diese Gemeinde bewertet gerade ihren kommunalen Klimaschutz – die Bewertung ist noch nicht abgeschlossen und
          daher noch nicht öffentlich sichtbar. Du kannst das Lokalteam unterstützen oder eine benachbarte Gemeinde
          erkunden.
        </p>
        <div class="flex flex-wrap gap-2">
          <CanonicalButton
            :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
            :label="$t('localteam.contact_action')"
            icon-slug="mdi:email-outline"
            color="orange"
          />
        </div>
      </div>
    </div>
    <NearbyMunicipalitiesCarousel
      v-if="directusData.municipalityScore.municipality.ars"
      :ars="directusData.municipalityScore.municipality.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> &larr; {{ backLabel }} </NuxtLink>
  </div>

  <!-- RATED_*: all states that render <detail-municipality> -->
  <div v-else-if="isRatedView && directusData.municipalityScore">
    <!-- RATED_DRAFT: unlocked draft preview — share banner with copy button -->
    <div
      v-if="pageView === PV.RATED_DRAFT"
      class="mb-6 flex items-start gap-3 border border-(--slk-border) bg-(--slk-orange-tint) p-4"
    >
      <Icon icon="mdi:eye-outline" class="mt-0.5 h-6 w-6 shrink-0 text-(--slk-orange)" :ariaHidden="true" />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base leading-snug font-bold text-gray">
          Vorschau: „{{ directusData.municipalityScore.municipality.name }}“
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          {{ $t("municipalities.preview_text") }}
        </p>
        <CanonicalButton
          :label="copiedState.draft ? $t('generic.link_copied') : $t('municipality.preview.share')"
          :icon-slug="copiedState.draft ? 'mdi:check' : 'mdi:share-variant-outline'"
          color="orange"
          @click="copyShareLink('draft')"
        />
      </div>
    </div>
    <!-- Outdated catalog notice -->
    <div
      v-else-if="pageView === PV.RATED_OUTDATED"
      class="mt-2 mb-6 flex items-start gap-3 border border-(--slk-border) bg-(--slk-blue-tint) p-4"
    >
      <Icon icon="mdi:information-outline" class="mt-0.5 h-6 w-6 shrink-0 text-(--slk-blue)" :ariaHidden="true" />
      <div class="min-w-0 flex-1">
        <p class="mb-1 font-heading text-base leading-snug font-bold text-gray">
          Älterer Maßnahmenkatalog: „{{ selectedCatalogVersion.name }}"
        </p>
        <p class="mb-3 text-sm leading-snug text-mid-gray">
          Diese Bewertung basiert auf einem älteren Maßnahmenkatalog. Hilf dem Lokalteam, die Bewertung auf den
          aktuellen Katalog zu aktualisieren!
        </p>
        <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <NuxtLink :to="`/municipalities/${slug}`" class="text-gray underline underline-offset-4 hover:no-underline"
            >Zur aktuellen Bewertung →</NuxtLink
          >
          <NuxtLink
            :to="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
            class="text-gray underline underline-offset-4 hover:no-underline"
            >Lokalteam kontaktieren →</NuxtLink
          >
        </div>
      </div>
    </div>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <article class="mt-5 mb-8">
      <detail-municipality
        :municipality-score="directusData.municipalityScore"
        :ratings-by-sector="directusData.ratingsBySector ?? {}"
      ></detail-municipality>
    </article>

    <!-- CTA block based on rating completeness -->
    <div class="mb-8">
      <!-- RATED_COMPLETE (all measures rated): contact / feedback -->
      <MunicipalityActionBox
        v-if="pageView === PV.RATED_COMPLETE"
        :title="$t('localteam.join')"
        :description="
          $t('municipality.callout.join_body', { ':name': directusData.municipalityScore.municipality.name })
        "
        icon="mdi:account-group-outline"
        tone="green"
      >
        <CanonicalButton
          :href="`/contact?title=${encodeURIComponent('Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mitmachen.\n\nMeine Kontaktdaten:\n')}`"
          :label="$t('generic.contact')"
          icon-slug="mdi:email-outline"
          color="dark-green"
        />
        <CanonicalButton
          :href="`/contact?title=${encodeURIComponent('Feedback zu ' + directusData.municipalityScore.municipality.name)}&type=suggestion&content=${encodeURIComponent('Kommune: ' + directusData.municipalityScore.municipality.name + '\nLink: /municipalities/' + route.params.slug + '\n\nMein Feedback:\n')}`"
          :label="$t('feedback.give')"
          icon-slug="mdi:message-outline"
          color="dark-green"
        />
      </MunicipalityActionBox>

      <!-- RATED_IN_PROGRESS / RATED_DRAFT: help the team complete the rating -->
      <MunicipalityActionBox
        v-else-if="pageView === PV.RATED_DRAFT"
        :title="$t('localteam.support')"
        :description="
          $t('municipality.callout.support_body', { ':name': directusData.municipalityScore.municipality.name })
        "
        icon="mdi:account-group-outline"
        tone="orange"
      >
        <CanonicalButton
          :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + directusData.municipalityScore.municipality.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
          :label="$t('localteam.support')"
          icon-slug="icon_team"
          color="orange"
        />
      </MunicipalityActionBox>

      <!-- RATED_OUTDATED: encourage update to current catalog -->
      <MunicipalityActionBox
        v-else-if="pageView === PV.RATED_OUTDATED"
        :title="$t('search.rating.update')"
        :description="
          $t('municipality.callout.update_body', {
            ':name': directusData.municipalityScore.municipality.name,
            ':catalog': selectedCatalogVersion.name,
          })
        "
        icon="mdi:history"
        tone="orange"
      >
        <CanonicalButton
          :href="`/contact?title=${encodeURIComponent('Bewertung aktualisieren: ' + directusData.municipalityScore.municipality.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte das Lokalteam in ' + directusData.municipalityScore.municipality.name + ' dabei unterstützen, die Bewertung auf den aktuellen Maßnahmenkatalog zu aktualisieren.\n\nMeine Kontaktdaten:\n')}`"
          :label="$t('localteam.contact_action')"
          icon-slug="mdi:email-outline"
          color="orange"
        />
      </MunicipalityActionBox>
    </div>

    <NearbyMunicipalitiesCarousel
      v-if="directusData.municipalityScore.municipality.ars"
      :ars="directusData.municipalityScore.municipality.ars ?? undefined"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
  </div>

  <!-- LOADING: waiting for Stadt-Land-Zahl look-up -->
  <div v-else-if="pageView === PV.LOADING" class="mt-10 animate-pulse">
    <div class="mb-8 h-5 w-40 rounded-sm bg-gray-200"></div>
    <div class="relative mb-3 flex items-stretch gap-4 bg-rating-0/10 py-5 pr-4 pl-10">
      <div class="mt-6 h-8 w-8 shrink-0 rounded-sm bg-gray-300"></div>
      <div class="grow space-y-2 pt-2">
        <div class="h-8 w-64 rounded-sm bg-gray-300"></div>
        <div class="h-4 w-32 rounded-sm bg-gray-200"></div>
      </div>
    </div>
    <div class="mb-6 h-12 w-full rounded-sm bg-gray-200"></div>
    <div class="mt-6 space-y-4">
      <div class="h-36 w-full rounded-sm bg-gray-100 shadow-list"></div>
      <div class="h-16 w-full rounded-sm bg-gray-100 shadow-list"></div>
      <div class="h-16 w-full rounded-sm bg-gray-100 shadow-list"></div>
    </div>
  </div>

  <!-- SLZ_FOUND: no score, area found in Stadt-Land-Zahl (ARS-based page) -->
  <div v-else-if="pageView === PV.SLZ_FOUND && slzArea && unratedMunicipality">
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <article class="mt-5 mb-8">
      <MunicipalityDetailHero :name="slzArea.name" :introduction="$t('municipality.hero.unrated_introduction')" />
      <div class="grid w-full gap-6 lg:grid-cols-3 lg:gap-8">
        <div class="lg:col-span-2">
          <MunicipalityActionBox
            v-if="hasLocalteam"
            :title="$t('localteam.support')"
            :description="$t('municipality.callout.support_body', { ':name': slzArea.name })"
            icon="mdi:account-group-outline"
            tone="orange"
          >
            <CanonicalButton
              :href="`/contact?title=${encodeURIComponent('Mitarbeit Lokalteam ' + slzArea.name)}&type=cooperation&content=${encodeURIComponent('Ich möchte beim Lokalteam in ' + slzArea.name + ' mithelfen.\n\nMeine Kontaktdaten:\n')}`"
              :label="$t('localteam.support')"
              icon-slug="icon_team"
              color="orange"
            />
          </MunicipalityActionBox>
          <MunicipalityActionBox
            v-else
            :title="$t('localteam.create')"
            :description="$t('municipality.callout.found_body', { ':name': slzArea.name })"
            icon="mdi:map-marker-plus-outline"
            tone="green"
          >
            <CanonicalButton
              :href="`/register_localteam?ars=${slzArea.ars}&name=${encodeURIComponent(slzArea.name)}`"
              :label="$t('localteam.create_now')"
              icon-slug="icon_location_green_marker"
              color="dark-green"
            />
          </MunicipalityActionBox>
        </div>
        <div class="pb-4 lg:col-span-1">
          <div class="space-y-6 lg:sticky lg:top-24">
            <DetailMunicipalityQuickInfoDesktop
              :municipality="unratedMunicipality"
              :municipality-type-label="slzArea.prefix"
            />
            <div class="rounded-xs border border-(--slk-border) bg-(--slk-blue-tint) p-4 shadow-list">
              <CanonicalButton
                :href="`/data/${slzArea.ars}`"
                :label="$t('stats.title')"
                icon-slug="icon_evaluation_criteria"
                color="dark"
                class="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
    <NearbyMunicipalitiesCarousel
      v-if="slzArea.ars"
      :ars="slzArea.ars"
      :catalog-version-id="selectedCatalogVersion.id"
      :catalog-version-name="selectedCatalogVersion.name"
      class="my-8"
    />
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
  </div>

  <!-- Case 3: Not found anywhere -->
  <div v-else>
    <NuxtLink :to="backHref" class="font-heading text-h4 text-light-blue"> ← {{ backLabel }} </NuxtLink>
    <waving-banner>
      {{ $t("municipality_missing") }}
    </waving-banner>
  </div>
</template>

<script setup lang="ts">
import type { Municipality } from "~/types/components/municipality";
import { Icon } from "@iconify/vue";
import { useMunicipalityPageState } from "~/composables/useMunicipalityPageState";
import { useReferrer } from "~/composables/useReferrer";
import { MunicipalityPageSchema } from "~/shared/contracts/municipality";
import { parseGeoCenter } from "~/shared/contracts/geometry";
import { routeSlug, singleRouteValue } from "~/shared/routeValues";
const fetchContent = useContentFetch();

const { $t } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const slug = routeSlug(route.params.slug);
if (!slug) throw createError({ statusCode: 404, statusMessage: "Municipality not found" });

// Guard against browser devtools / extension source-map requests like "installHook.js.map"
// Municipality slugs are always lowercase alphanumeric + hyphens and never contain dots.
if (typeof route.params.slug === "string" && route.params.slug.includes(".")) {
  throw createError({ statusCode: 404, statusMessage: "Not Found" });
}

// Remount for catalog/preview changes so children that capture initial props
// update too. This uses the caller's own URL, never a stored Directus credential.
definePageMeta({ key: (route) => route.fullPath });
const suppliedPreview = route.query.preview === "true" ? route.query.preview_token : route.query.preview;
const previewToken = typeof suppliedPreview === "string" ? suppliedPreview : "";
const municipalityPath = encodeURIComponent(slug);
// useId is SSR/hydration-stable and changes with each page instance. Never use
// the raw token as an async-data key or reuse a previous authorized navigation.
const pageDataKey = `municipality-page-${useId()}`;
const loadPage = async (preview: boolean) =>
  MunicipalityPageSchema.parse(
    await fetchContent(
      preview ? `/api/previews/municipality/${municipalityPath}` : `/api/public/municipalities/${municipalityPath}`,
      {
        query: { v: singleRouteValue(route.query.v) },
        ...(preview ? { headers: { "x-preview-token": previewToken } } : {}),
      },
    ),
  );
const { data: pageData, error: pageDataError } = await useAsyncData(pageDataKey, () => loadPage(!!previewToken), {
  getCachedData: (key, app) => {
    if (!app.isHydrating) return undefined;
    const result = MunicipalityPageSchema.safeParse(app.payload.data[key]);
    return result.success ? result.data : undefined;
  },
});
onUnmounted(() => {
  clearNuxtData(pageDataKey);
});
// Invalid preview credentials show the ordinary locked page, while the API
// itself rejects them. Upstream failures must not silently become public data.
if (pageDataError.value?.status === 404 && previewToken) {
  pageData.value = await loadPage(false);
} else if (pageDataError.value) {
  throw createError({ statusCode: 502, statusMessage: "Municipality data unavailable" });
}
if (!pageData.value) throw createError({ statusCode: 502, statusMessage: "Municipality data unavailable" });
const selectedCatalogVersion = pageData.value.selectedCatalogVersion;
const directusData = pageData.value.directusData;
const previewAuthorized = pageData.value.previewAuthorized;
const directusMuniBySlug = ref(pageData.value.municipality);
const directusMuniByArs = ref(pageData.value.municipality?.localteam_id ? pageData.value.municipality : null);
const { backHref, backLabel } = useReferrer(
  computed(() => `/municipalities?v=${selectedCatalogVersion.name}`),
  computed(() => $t("municipality.back_label")),
);

// Change the URL to match the catalog version, if it didn't to begin with
if (import.meta.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    void router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}

// If no Directus data, fetch the area through the Nuxt server endpoint so the
// same lookup works during SSR and client-side navigation.
const slzAreaLookup = useAsyncData(`slz-area-${slug}`, async () => {
  if (directusData?.municipalityScore) return null;
  try {
    const data = await $fetch("/api/area-by-slug", {
      query: { slug },
    });
    if (data?.name) {
      const stateArea = data.contained_by?.find((area) => area.level === 2);
      return {
        name: data.name,
        prefix: data.prefix ?? "",
        state: stateArea?.name ?? data.state ?? null,
        ars: data.ars ?? slug!,
        population: data.data_products?.population_data?.population ?? null,
        geo_center: parseGeoCenter(data.geo_center),
      };
    }
    return null;
  } catch {
    return null;
  }
});

const { data: slzArea, pending: slzPending } = await slzAreaLookup;

// Reuse the rated municipality facts card without inventing a score.
const unratedMunicipality = computed<Municipality | null>(() => {
  const area = slzArea.value;
  if (!area) return null;
  const municipality = directusMuniBySlug.value;
  return {
    ...municipality,
    id: municipality?.id ?? area.ars,
    name: area.name,
    slug,
    ars: area.ars,
    state: area.state,
    population: area.population,
    geolocation: area.geo_center ? { type: "Point", coordinates: [area.geo_center.lon, area.geo_center.lat] } : null,
  };
});

// Centralised page-view state. All 9 cases are documented in useMunicipalityPageState.js.
const {
  pageView,
  isRatedView,
  hasLocalteam,
  PAGE_VIEWS: PV,
} = useMunicipalityPageState({
  directusData,
  selectedCatalogVersion,
  directusMuniBySlug,
  slzArea,
  slzPending,
  directusMuniByArs,
  previewAuthorized,
});

// Show 404 once all look-ups have settled and nothing was found.
// Guard: if directusMuniBySlug resolves (published-but-unscored edge case), suppress the 404.
watch(
  [pageView, directusMuniBySlug],
  ([view, muniBySlug]) => {
    if (view === PV.NOT_FOUND && !muniBySlug) {
      showError({ statusCode: 404, statusMessage: "Gemeinde nicht gefunden" });
    }
  },
  { immediate: true },
);

// Copy-to-clipboard state for share buttons
const copiedState = reactive({ preview: false, draft: false });
function copyShareLink(key: "preview" | "draft") {
  if (import.meta.client) {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      copiedState[key] = true;
      setTimeout(() => {
        copiedState[key] = false;
      }, 2000);
    });
  }
}

// Display name for the municipality on locked/preview pages (score may not always exist)
const previewMuniName = computed(
  () =>
    directusData?.municipalityScore?.municipality?.name ??
    (directusMuniBySlug.value && directusMuniBySlug.value.name) ??
    String(route.params.slug),
);

// MetaTags
const pageTitle = directusData?.municipalityScore?.municipality?.name ?? slzArea.value?.name ?? slug;
const title = ref(pageTitle);
const seoText = useSeoText();
const { $locale } = useNuxtApp();
usePageSeo({
  title,
  description: () => seoText("seo.municipality.description", { ":name": title.value }),
  socialImagePath: () => {
    const score = directusData?.municipalityScore;
    return score?.published === true &&
      Number(score.percentage_rated) >= 100 &&
      score.municipality.status === "published"
      ? `/api/public/municipalities/${score.municipality.slug}/social-image?${new URLSearchParams({ v: score.catalog_version.name, lang: $locale })}`
      : undefined;
  },
});
</script>
